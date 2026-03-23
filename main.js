document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('appointment-form');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const successScreen = document.getElementById('success-screen');

  if (form) {
    form.addEventListener('submit', (e) => {
      e.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      // Simular carga de envió
      const originalText = btnText.textContent;
      btnText.textContent = 'Procesando cita...';
      btnSubmit.style.opacity = '0.8';
      btnSubmit.style.pointerEvents = 'none';

      setTimeout(() => {
        // Mostrar pantalla de éxito
        successScreen.classList.add('active');
        
        // Reset botones (aunque esten tapados)
        btnText.textContent = originalText;
        btnSubmit.style.opacity = '1';
        btnSubmit.style.pointerEvents = 'auto';
        form.reset();
      }, 1500);
    });
  }
});
