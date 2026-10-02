import importlib.util
import io
import tempfile
import unittest
from pathlib import Path
from PIL import Image

spec = importlib.util.spec_from_file_location('media', Path(__file__).parents[1]/'scripts/media_webp.py')
media = importlib.util.module_from_spec(spec)
spec.loader.exec_module(media)

class LosslessTests(unittest.TestCase):
    def png(self, mode='RGBA', animated=False):
        image=Image.new(mode,(128,96),(180,75,23,127) if mode=='RGBA' else (180,75,23))
        buffer=io.BytesIO()
        if animated:
            image.save(buffer,format='PNG',save_all=True,append_images=[Image.new(mode,image.size,(1,2,3,255))],duration=100,loop=0)
        else:
            image.save(buffer,format='PNG',compress_level=0)
        return buffer.getvalue()

    def test_pixel_dimensions_alpha_identical(self):
        original=self.png()
        converted,reason=media.lossless_webp(original)
        self.assertEqual(reason,'converted')
        self.assertLess(len(converted),len(original))
        with Image.open(io.BytesIO(original)) as a, Image.open(io.BytesIO(converted)) as b:
            self.assertEqual(a.size,b.size)
            self.assertEqual(a.convert('RGBA').tobytes(),b.convert('RGBA').tobytes())

    def test_jpeg_does_not_gain_new_pixel_loss(self):
        image=Image.new('RGB',(80,60),(10,40,70));buffer=io.BytesIO();image.save(buffer,format='JPEG',quality=100)
        result,reason=media.lossless_webp(buffer.getvalue())
        if result:
            with Image.open(io.BytesIO(result)) as a,Image.open(io.BytesIO(buffer.getvalue())) as b:
                self.assertEqual(a.convert('RGBA').tobytes(),b.convert('RGBA').tobytes())
        else:
            self.assertEqual(reason,'not-smaller')

    def test_animation_and_high_bit_depth_kept(self):
        self.assertEqual(media.lossless_webp(self.png(animated=True))[1],'unsupported-or-animated')
        image=Image.new('I;16',(32,32),12345);buffer=io.BytesIO();image.save(buffer,format='PNG')
        self.assertEqual(media.lossless_webp(buffer.getvalue())[1],'unsupported-color-mode')

    def test_icc_and_orientation_preserved(self):
        image=Image.new('RGB',(128,96),(20,30,40))
        exif=Image.Exif();exif[274]=6
        buffer=io.BytesIO();image.save(buffer,format='PNG',compress_level=0,icc_profile=b'test-profile',exif=exif)
        output,reason=media.lossless_webp(buffer.getvalue())
        self.assertEqual(reason,'converted')
        with Image.open(io.BytesIO(output)) as result:
            self.assertEqual(result.info['icc_profile'],b'test-profile')
            self.assertEqual(result.getexif()[274],6)

    def test_nested_references_query_urls_and_collision(self):
        url=media.PUBLIC+'folder/a.png';new=media.PUBLIC+'folder/a.webp'
        mapping={'folder/a.png':'folder/a.webp',url:new}
        row={'gallery':[{'url':url,'storagePath':'folder/a.png','contentType':'image/png'}],
             'html':f'<img src="{url}?v=2"><img src="{url}other.png">', 'title':'Untouched'}
        result=media.replace_refs(row,mapping)
        self.assertEqual(result['gallery'][0]['url'],new)
        self.assertEqual(result['gallery'][0]['contentType'],'image/webp')
        self.assertIn(new+'?v=2',result['html'])
        self.assertIn(url+'other.png',result['html'])
        self.assertEqual(result['title'],'Untouched')

    def test_sql_is_atomic_guarded_idempotent_and_reverse(self):
        change={'table':'assets','key':{'id':{'value':'abc','type':'text'}},
                'columns':{'url':{'before':"old'path",'after':'new-path','type':'text'}}}
        forward=media.guarded_sql([change]);backward=media.guarded_sql([change],True)
        for sql in (forward,backward):
            self.assertIn('BEGIN;',sql);self.assertIn('COMMIT;',sql)
            self.assertIn('IS NOT DISTINCT FROM',sql);self.assertIn('RAISE EXCEPTION',sql)
        self.assertIn('"url"=$azo$new-path$azo$::text',forward)
        self.assertIn('"url"=$azo$old\'path$azo$::text',backward)

    def test_plan_maps_assets_and_nested_obras_without_mutation(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp);(path/'originals').mkdir();data=self.png();(path/'originals/a.bin').write_bytes(data)
            objects=[{'name':'site/a.png','local':'originals/a.bin','sha256':media.digest(data),'size':len(data)}]
            url=media.PUBLIC+'site/a.png'
            def table(row,types):
                return {'pk':['id'],'columns':{key:{'type_name':types.get(key,'text'),'is_generated':'NEVER'} for key in row},'rows':[row]}
            asset={'id':'a','path':'assets/images/builtin.png','url':url,'storage_path':'site/a.png','content_type':'image/png','file_name':'a.png','size':len(data)}
            obra={'id':'b','gallery':[{'url':url,'storagePath':'site/a.png'}],'interactive_plan':{'imageUrl':url,'storagePath':'site/a.png'}}
            backup={'project':media.PROJECT,'bucket':media.BUCKET,'complete':True,'created_at':'2026-10-02T12:00:00Z','objects':objects,
                'database':{'assets':table(asset,{'size':'bigint'}),'obras':table(obra,{'gallery':'jsonb','interactive_plan':'jsonb'})}}
            media.save_json(path/'backup.json',backup)
            plan=media.build_plan(path)
            self.assertEqual(len(plan['files']),1);self.assertEqual(len(plan['changes']),2)
            self.assertNotIn('path',plan['changes'][0]['columns'])
            self.assertEqual(plan['changes'][0]['columns']['content_type']['after'],'image/webp')
            self.assertEqual(plan['changes'][1]['columns']['gallery']['before'],obra['gallery'])
            self.assertTrue(plan['changes'][1]['columns']['interactive_plan']['after']['imageUrl'].endswith('.webp'))
            self.assertEqual(media.load_json(path/'backup.json'),backup)
            class BrokenPublicAPI:
                def __init__(self):self.writes=[];self.uploads=[]
                def download(self,name,public=False):
                    if public:return b'wrong-object'
                    if name=='site/a.png':return data
                    raise RuntimeError('API request failed: HTTP 404')
                def upload(self,*args):self.uploads.append(args)
                def query(self,sql,write=False):self.writes.append(sql)
            api=BrokenPublicAPI()
            with self.assertRaises(RuntimeError):media.apply(api,path)
            self.assertEqual(len(api.uploads),1)
            self.assertEqual(api.writes,[]) # No database changes before public verification.
            self.assertEqual(media.load_json(path/'plan.json')['state'],'applying')

    def test_sql_json_equality_and_dollar_quoting(self):
        change={'table':'assets','key':{'id':{'value':'id','type':'text'}},
                'columns':{'data':{'before':{'v':'$migration$'},'after':{'v':'new'},'type':'json'}}}
        sql=media.guarded_sql([change])
        self.assertIn('DO $migrationx$',sql)
        self.assertIn('"data"::jsonb IS NOT DISTINCT FROM',sql)
        self.assertIn('END; $migrationx$;',sql)

    def test_backup_integrity_gate(self):
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp);media.save_json(path/'backup.json',{'project':media.PROJECT,'bucket':media.BUCKET,'complete':False})
            with self.assertRaises(RuntimeError):media.validate_backup(path)
            (path/'source.bin').write_bytes(b'edited')
            media.save_json(path/'backup.json',{'project':media.PROJECT,'bucket':media.BUCKET,'complete':True,
                'objects':[{'local':'source.bin','sha256':media.digest(b'original')}]})
            with self.assertRaises(RuntimeError):media.validate_backup(path)

if __name__=='__main__':unittest.main()
