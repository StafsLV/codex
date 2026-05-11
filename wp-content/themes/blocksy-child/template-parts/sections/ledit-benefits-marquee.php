<?php
/**
 * Ledit benefits marquee section.
 *
 * Usage:
 * get_template_part('template-parts/sections/ledit-benefits-marquee');
 */
?>
<section class="ledit-benefits" aria-label="Kāpēc izvēlēties ledit.lv">
  <div class="ledit-benefits__inner">
    <header class="ledit-benefits__head">
      <h2 class="ledit-benefits__title">Kāpēc izvēlēties ledit.lv?</h2>
      <p class="ledit-benefits__subtitle">Ātra un moderna īpašumu pārdošanas pieredze ar skaidru procesu un prognozējamu rezultātu.</p>
    </header>

    <div class="ledit-benefits__mask">
      <div class="ledit-benefits__track">
        <?php
        $benefits = [
          ['Ātrs starts', 'Sāc publicēt sludinājumu dažu minūšu laikā bez liekas sarežģītības.'],
          ['Vienkāršs process', 'Soli pa solim plūsma palīdz ievadīt visu nepieciešamo informāciju.'],
          ['Uzticams iespaids', 'Profesionāls noformējums palīdz īpašumam izcelties pircēju acīs.'],
          ['Pārskatāma informācija', 'Visi dati un fotogrāfijas strukturēti, lai pircējs ātri saprot būtisko.'],
          ['Mobilajām ierīcēm draudzīgs', 'Sludinājumi un pārvaldība ērti lietojami telefonā un datorā.'],
          ['Droša platforma', 'Stabils tehniskais pamats ikdienas darbam un datu pārvaldībai.'],
        ];

        // Duplicate list once to keep marquee animation seamless.
        $marquee_items = array_merge($benefits, $benefits);
        foreach ($marquee_items as $item) :
        ?>
          <article class="ledit-benefit">
            <span class="ledit-benefit__icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M6 12.5l4 4L18 8" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
              </svg>
            </span>
            <h3 class="ledit-benefit__title"><?php echo esc_html($item[0]); ?></h3>
            <p class="ledit-benefit__text"><?php echo esc_html($item[1]); ?></p>
          </article>
        <?php endforeach; ?>
      </div>
    </div>
  </div>
</section>
