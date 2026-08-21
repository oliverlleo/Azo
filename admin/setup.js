const form = document.getElementById('setup-form');
const message = document.getElementById('setup-message');
const button = form.querySelector('button[type="submit"]');

function show(text, error = false) {
  message.textContent = text || '';
  message.style.color = error ? 'var(--danger)' : 'var(--ok)';
}

form.addEventListener('submit', async event => {
  event.preventDefault();
  show('');
  button.disabled = true;
  button.querySelector('span').textContent = 'Criando...';
  try {
    const response = await fetch('https://jjrsbbgnqfiezhokxbqz.supabase.co/functions/v1/azo-bootstrap-admin', {
      method: 'POST',
      headers: { 'Content-Type':'application/json' },
      body: JSON.stringify({
        setupSecret: document.getElementById('setup-secret').value,
        name: document.getElementById('setup-name').value.trim(),
        email: document.getElementById('setup-email').value.trim(),
        password: document.getElementById('setup-password').value
      })
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Não foi possível criar o administrador.');
    show('Administrador criado. Abrindo o login...');
    form.reset();
    setTimeout(() => location.replace('./'), 900);
  } catch (error) {
    show(error.message || 'Não foi possível criar o administrador.', true);
  } finally {
    button.disabled = false;
    button.querySelector('span').textContent = 'Criar administrador';
  }
});
