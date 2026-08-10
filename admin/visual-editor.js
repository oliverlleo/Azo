// Estabiliza a sessão visual do admin para evitar voltar à tela de login
// durante restauração/revalidação do Firebase ou ao retornar para a aba.
import './auth-ui-stability.js?v=20260810-0723';

// Editor visual atual.
// Permite escolher todos os textos de um mesmo bloco e todas as imagens sobrepostas,
// inclusive imagens ocultas de carrosséis. Quando o clique é exatamente sobre texto,
// a edição de texto tem prioridade sobre imagens de fundo.
import './visual-editor-v3.js?v=20260809-2038';
import './visual-editor-v3-precision.js?v=20260809-2038';
import './visual-editor-text-precision.js?v=20260809-2038';

// Deve ser carregado ANTES da persistência para guardar a página atual e impedir
// que o recarregamento pós-save volte a prévia/painel para a página inicial.
import './visual-editor-save-stability.js?v=20260810-0746';
import './visual-editor-persist.js?v=20260810-0746';

// A troca de "Página do site" deve recarregar somente a prévia e nunca tirar
// o usuário do modo Editar visualmente.
import './visual-editor-navigation-stability.js?v=20260810-0746';
