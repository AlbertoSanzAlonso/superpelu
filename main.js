const subservicesData = {
  corte_caballero: [
    { value: "caballero", label: "Corte de caballero - Gentleman haircut" },
    { value: "nino", label: "Corte de NIÑO - Boys Haircut" }
  ],
  color: [
    { value: "lavar", label: "LAVAR COLOR - WASH COLOR (1h después de tu hora de color)" },
    { value: "raiz", label: "Color en Raiz - Root Color" },
    { value: "completo", label: "Color Completo - Complet Color" },
    { value: "block", label: "Color Block (Ej: Nuca de un color, resto otro)" },
    { value: "matiz", label: "Matiz - Toner" }
  ],
  decoloracion: [
    { value: "raiz", label: "Decoloración en Raiz - Root Bleaching" },
    { value: "global", label: "Decoloracion Global - Complet Bleaching" },
    { value: "parcial", label: "Decoloracion Parcial - Partial Bleaching (Ej: Nuca, Patillas)" }
  ],
  corte_peinado: [
    { value: "corto", label: "Cabello CORTO (Hasta la nuca)" },
    { value: "medio", label: "Cabello MEDIO (Hasta los hombros)" },
    { value: "largo", label: "Cabello LARGO (Por debajo de hombros)" },
    { value: "difusor", label: "Con Difusor - Resultado rizado" },
    { value: "ondas", label: "Con ONDAS - Wavy style" }
  ],
  corte: [
    { value: "corto", label: "Cabello CORTO (Hasta la nuca)" },
    { value: "medio", label: "Cabello MEDIO (Hasta los hombros)" },
    { value: "largo", label: "Cabello LARGO (Por debajo de hombros)" },
    { value: "extralargo", label: "Cabello EXTRA LARGO (De mitad espalda en adelante)" },
    { value: "nina", label: "Corte de NIÑA - Girls Haircut" }
  ],
  peinado: [
    { value: "corto", label: "Cabello CORTO (Hasta la nuca)" },
    { value: "medio", label: "Cabello MEDIO (Hasta los hombros)" },
    { value: "largo", label: "Cabello LARGO (Por debajo de los hombros)" },
    { value: "extralargo", label: "Cabello EXTRA LARGO (De mitad espalda en adelante)" },
    { value: "ondas", label: "CON ONDAS - Wavy Hairstyle" },
    { value: "difusor", label: "CON DIFUSOR (Para cabello rizado)" },
    { value: "plancha", label: "Con PLANCHA - Straightening" },
    { value: "semirecogido", label: "Semi Recogido - Half-up Hairstyle" },
    { value: "recogido", label: "Recogido - Upstyle" }
  ],
  permanente: [
    { value: "corto", label: "Permanente Cabello CORTO" },
    { value: "medio", label: "Permanente Cabello MEDIO" },
    { value: "largo", label: "Permanente Cabello LARGO" }
  ],
  keratina: [
    { value: "corto", label: "Alisado en Cabello CORTO" },
    { value: "medio", label: "Alisado en Cabello MEDIO" },
    { value: "largo", label: "Alisado en Cabello LARGO" }
  ],
  tratamientos: [
    { value: "nutricion", label: "Nutrición - Nourishing Treatment" },
    { value: "hidratacion", label: "Hidratacion - Hydrating Treatment" },
    { value: "reparacion", label: "Reparación o Reconstrucción" }
  ],
  estetica_manos_pies: [
    { value: "manicura", label: "Manicura - Manicure" },
    { value: "francesa", label: "Manicura Francesa (Punta Francesa)" },
    { value: "semi", label: "Manicura Esmalte Semipermanente" },
    { value: "semi_retirado", label: "Manicura Semipermanente + Retirado" },
    { value: "pintar_manos", label: "Pintar manos esmalte normal" },
    { value: "retirado_semi", label: "Retirado Esmalte Semipermanente" },
    { value: "decoracion", label: "Decoracion de Uñas" },
    { value: "polygel", label: "Extension de uñas con POLYGEL" },
    { value: "relleno", label: "Relleno de POLYGEL" },
    { value: "retirado_poly", label: "Retirado ACRILO O POLYGEL" },
    { value: "pedicura", label: "Pedicura Tradicional" },
    { value: "pedi_semi", label: "Pedicura Esmalte Semipermante" },
    { value: "pintar_pies", label: "Pintar Pies esmalte normal" },
    { value: "manos_pies_normal", label: "Pintar manos y pies con esmalte normal" }
  ],
  estetica_facial: [
    { value: "cejas", label: "Depilacion de Cejas - Eyebrow Waxing" },
    { value: "labio", label: "Depilacion Labio Superior" },
    { value: "tinte_cejas", label: "Tinte de Cejas" },
    { value: "tinte_pestanas", label: "Tinte de Pestañas" },
    { value: "lifting", label: "Lifting de Pestañas (tinte incluido)" },
    { value: "laminado", label: "Laminado de Cejas" },
    { value: "limpieza", label: "Ritual Limpieza de cutis profunda" },
    { value: "dermapen", label: "Tratamiento Antioxidante con DERMAPEN" },
    { value: "micro", label: "MICROPIGMENTACION" },
    { value: "retoque_micro", label: "RETOQUE MICRO" }
  ]
};

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('appointment-form');
  const btnSubmit = document.getElementById('btn-submit');
  const btnText = btnSubmit.querySelector('.btn-text');
  const successScreen = document.getElementById('success-screen');
  
  const serviceSelect = document.getElementById('service');
  const subserviceGroup = document.getElementById('subservice-group');
  const subserviceSelect = document.getElementById('subservice');
  const serviceAlert = document.getElementById('service-alert');
  const colorHint = document.getElementById('color-hint');
  
  const dateInput = document.getElementById('date_pref');
  const timeSelect = document.getElementById('time_pref');

  // Handle service change
  serviceSelect.addEventListener('change', (e) => {
    const selectedService = e.target.value;
    
    // Reset secondary states
    subserviceGroup.style.display = 'none';
    serviceAlert.style.display = 'none';
    colorHint.style.display = 'none';
    subserviceSelect.disabled = true;
    subserviceSelect.removeAttribute('required');
    btnSubmit.disabled = false;
    btnSubmit.style.opacity = '1';

    // Show color specific hint
    if (selectedService === 'color') {
      colorHint.style.display = 'block';
    }

    if (selectedService === 'mechas') {
      // Show alert for "Mechas" and disable submit
      serviceAlert.style.display = 'block';
      btnSubmit.disabled = true;
      btnSubmit.style.opacity = '0.5';
    } 
    else if (subservicesData[selectedService]) {
      // Populate subservices dynamic select
      subserviceSelect.innerHTML = '<option value="" disabled selected>Elige una opción obligatoria</option>';
      subservicesData[selectedService].forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        subserviceSelect.appendChild(optionEl);
      });
      subserviceGroup.style.display = 'flex';
      subserviceSelect.disabled = false;
      subserviceSelect.setAttribute('required', 'true');
    }
  });

  // Handle date change for mocked times
  dateInput.addEventListener('change', (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate) {
      timeSelect.innerHTML = '<option value="" disabled selected>Primero elige un día</option>';
      timeSelect.disabled = true;
      return;
    }

    // Activar selector y simular carga rapida
    timeSelect.disabled = false;
    timeSelect.innerHTML = '<option value="" disabled selected>Buscando huecos libres...</option>';
    
    setTimeout(() => {
      // Possible times (09:00 to 19:30 every 30 mins)
      const times = [
        "09:00", "09:30", "10:00", "10:30", "11:00", "11:30", "12:00", "12:30", "13:00", "13:30", "14:00", 
        "16:00", "16:30", "17:00", "17:30", "18:00", "18:30", "19:00", "19:30"
      ];
      
      timeSelect.innerHTML = '<option value="" disabled selected>Elige hora (Sujeto a confirmación)</option>';
      
      // Pseudo random seed based on date so it's consistent for the same day
      const dateNum = new Date(selectedDate).getDate() || 1;
      
      times.forEach((time, index) => {
        const option = document.createElement('option');
        option.value = time;
        
        // Mock unavailability logic - mix of math and date
        // Makes approx 40% of the times unavailable
        const isOccupied = ((dateNum + index * 13) % 10) < 4;
        
        if (isOccupied) {
          option.textContent = `${time} -  Ocupado`;
          option.disabled = true;
        } else {
          option.textContent = time;
        }
        
        timeSelect.appendChild(option);
      });
    }, 400); // Small artificial delay
  });

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
        
        // Reset botones
        btnText.textContent = originalText;
        btnSubmit.style.opacity = '1';
        btnSubmit.style.pointerEvents = 'auto';
        form.reset();
        
        // Esconder secundarios tras éxito
        subserviceGroup.style.display = 'none';
        serviceAlert.style.display = 'none';
        colorHint.style.display = 'none';
        subserviceSelect.disabled = true;
        
        // Reset Time select
        timeSelect.innerHTML = '<option value="" disabled selected>Primero elige un día</option>';
        timeSelect.disabled = true;
      }, 1500);
    });
  }
});
