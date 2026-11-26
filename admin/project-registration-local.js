const DB='azo-project-registration',STORE='queues';
function database(){return new Promise((resolve,reject)=>{const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>{request.result.createObjectStore(STORE)};request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);request.onblocked=()=>reject(Error('Armazenamento local ocupado.'))})}
async function operation(mode,action){const db=await database();try{return await new Promise((resolve,reject)=>{const tx=db.transaction(STORE,mode),req=action(tx.objectStore(STORE));tx.oncomplete=()=>resolve(req.result);tx.onerror=()=>reject(tx.error||req.error);tx.onabort=()=>reject(tx.error||Error('Armazenamento local interrompido.'))})}finally{db.close()}}
const key=(uid,id)=>uid+':'+id;
export function saveQueue(uid,id,queue){return operation('readwrite',s=>s.put(queue,key(uid,id)))}
export function loadQueue(uid,id){return operation('readonly',s=>s.get(key(uid,id)))}
export function removeQueue(uid,id){return operation('readwrite',s=>s.delete(key(uid,id)))}
export async function listQueues(uid){return operation('readonly',s=>s.getAll(IDBKeyRange.bound(uid+':',uid+':\uffff')))}
