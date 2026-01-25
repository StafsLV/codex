(() => {
    const customizers = document.querySelectorAll('[data-neon-customizer]');

    customizers.forEach((customizer) => {
        const textInput = customizer.querySelector('[data-neon-input="text"]');
        const colorInput = customizer.querySelector('[data-neon-input="color"]');
        const sizeInput = customizer.querySelector('[data-neon-input="size"]');
        const fontInput = customizer.querySelector('[data-neon-input="font"]');
        const backingInput = customizer.querySelector('[data-neon-input="backing"]');
        const previewText = customizer.querySelector('[data-neon-text]');
        const backing = customizer.querySelector('[data-neon-backing]');

        if (!previewText || !backing) {
            return;
        }

        const updateText = () => {
            const value = textInput?.value?.trim() || 'Open';
            previewText.textContent = value;
        };

        const updateColor = () => {
            const value = colorInput?.value || '#ff4fd8';
            previewText.style.color = value;
            previewText.style.textShadow = `0 0 6px ${value}, 0 0 12px ${value}, 0 0 24px ${value}, 0 0 48px ${value}`;
        };

        const updateSize = () => {
            const value = sizeInput?.value || '72';
            previewText.style.fontSize = `${value}px`;
        };

        const updateFont = () => {
            const value = fontInput?.value || '"Neon Glow", "Segoe UI", sans-serif';
            previewText.style.fontFamily = value;
        };

        const updateBacking = () => {
            const value = backingInput?.value || 'clear';
            backing.classList.remove('neon-customizer__backing--cutout', 'neon-customizer__backing--rectangle');

            if (value === 'cutout') {
                backing.classList.add('neon-customizer__backing--cutout');
            }

            if (value === 'rectangle') {
                backing.classList.add('neon-customizer__backing--rectangle');
            }
        };

        [textInput, colorInput, sizeInput, fontInput, backingInput].forEach((input) => {
            input?.addEventListener('input', () => {
                updateText();
                updateColor();
                updateSize();
                updateFont();
                updateBacking();
            });
        });

        updateText();
        updateColor();
        updateSize();
        updateFont();
        updateBacking();
    });
})();
