<?php
/**
 * Plugin Name: Neon Sign Customizer
 * Description: Provides a frontend neon sign customizer with live preview (text, color, size, font, and backing).
 * Version: 1.0.0
 * Author: Codex
 * Text Domain: neon-sign-customizer
 */

if (!defined('ABSPATH')) {
    exit;
}

class Neon_Sign_Customizer {
    const SHORTCODE = 'neon_sign_customizer';

    public function __construct() {
        add_action('wp_enqueue_scripts', [$this, 'register_assets']);
        add_shortcode(self::SHORTCODE, [$this, 'render_shortcode']);
    }

    public function register_assets(): void {
        $base_url = plugin_dir_url(__FILE__);

        wp_register_style(
            'neon-sign-customizer',
            $base_url . 'assets/css/neon-customizer.css',
            [],
            '1.0.0'
        );

        wp_register_script(
            'neon-sign-customizer',
            $base_url . 'assets/js/neon-customizer.js',
            [],
            '1.0.0',
            true
        );
    }

    public function render_shortcode(): string {
        wp_enqueue_style('neon-sign-customizer');
        wp_enqueue_script('neon-sign-customizer');

        $fonts = [
            'Neon Glow' => '"Neon Glow", "Segoe UI", sans-serif',
            'Script' => '"Pacifico", "Brush Script MT", cursive',
            'Modern' => '"Montserrat", "Helvetica Neue", sans-serif',
            'Retro' => '"Bungee", "Impact", sans-serif',
        ];

        ob_start();
        ?>
        <div class="neon-customizer" data-neon-customizer>
            <div class="neon-customizer__panel">
                <h2 class="neon-customizer__title"><?php esc_html_e('Neona zīmes pielāgošana', 'neon-sign-customizer'); ?></h2>

                <label class="neon-customizer__field">
                    <span><?php esc_html_e('Teksts', 'neon-sign-customizer'); ?></span>
                    <input type="text" name="neon_text" value="Open" maxlength="20" data-neon-input="text" />
                </label>

                <label class="neon-customizer__field">
                    <span><?php esc_html_e('Krāsa', 'neon-sign-customizer'); ?></span>
                    <input type="color" name="neon_color" value="#ff4fd8" data-neon-input="color" />
                </label>

                <label class="neon-customizer__field">
                    <span><?php esc_html_e('Izmērs', 'neon-sign-customizer'); ?></span>
                    <input type="range" name="neon_size" min="24" max="120" value="72" data-neon-input="size" />
                </label>

                <label class="neon-customizer__field">
                    <span><?php esc_html_e('Fonts', 'neon-sign-customizer'); ?></span>
                    <select name="neon_font" data-neon-input="font">
                        <?php foreach ($fonts as $label => $font): ?>
                            <option value="<?php echo esc_attr($font); ?>"><?php echo esc_html($label); ?></option>
                        <?php endforeach; ?>
                    </select>
                </label>

                <label class="neon-customizer__field">
                    <span><?php esc_html_e('Pamatnes stils', 'neon-sign-customizer'); ?></span>
                    <select name="neon_backing" data-neon-input="backing">
                        <option value="clear"><?php esc_html_e('Caurspīdīga', 'neon-sign-customizer'); ?></option>
                        <option value="cutout"><?php esc_html_e('Izgriezta akrila', 'neon-sign-customizer'); ?></option>
                        <option value="rectangle"><?php esc_html_e('Taisnstūrveida', 'neon-sign-customizer'); ?></option>
                    </select>
                </label>
            </div>

            <div class="neon-customizer__preview" data-neon-preview>
                <div class="neon-customizer__backing" data-neon-backing>
                    <span class="neon-customizer__text" data-neon-text>Open</span>
                </div>
                <p class="neon-customizer__note"><?php esc_html_e('Priekšskatījums tiek atjaunināts reāllaikā.', 'neon-sign-customizer'); ?></p>
            </div>
        </div>
        <?php
        return (string) ob_get_clean();
    }
}

new Neon_Sign_Customizer();
