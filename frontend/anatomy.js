const anatomy = document.querySelector('#anatomy');
const maps = anatomy.querySelector('.anatomy-maps');
const controls = anatomy.querySelector('.anatomy-controls');
const selection = anatomy.querySelector('#anatomy-selection');
const buttons = [...controls.querySelectorAll('button[data-region]')];

// Original schematic: draw one side of the silhouette and mirror it at x=80.
const half = 'M80 43 L68 43 Q67 52 59 54 L47 57 Q34 59 31 73 L25 107 Q19 126 17 148 L12 173 Q10 184 16 188 L24 178 L27 163 L37 144 L46 114 L51 93 L55 115 L51 137 Q46 157 50 181 L56 208 Q52 229 58 247 L60 272 L53 280 Q50 287 60 287 L74 285 Q78 283 75 274 L76 247 L77 209 L80 166';
const shared = {
  shoulders: 'M48 60 Q35 62 34 75 L31 88 Q43 87 49 73 L54 62 Z',
  arms: 'M32 91 Q43 89 47 80 L43 108 Q40 118 34 120 L28 116 Z M28 120 L34 124 L30 140 L21 159 L19 155 Z',
};
const front = {
  ...shared,
  chest: 'M56 63 Q67 57 77 63 L77 85 Q65 91 51 82 Z',
  core: 'M54 89 Q66 94 77 89 L77 128 L73 142 Q59 134 57 118 Z',
  quads: 'M55 139 Q65 144 76 154 L75 183 L70 207 Q64 214 60 200 L54 177 Q51 154 55 139 Z',
};
const back = {
  ...shared,
  back: 'M62 55 L73 48 L77 51 L77 134 Q67 130 58 136 L59 114 Q53 104 51 88 L56 67 Z',
  glutes: 'M55 140 Q64 132 77 138 L77 159 Q69 172 53 166 Q51 154 55 140 Z',
  hamstrings: 'M54 171 Q67 175 76 167 L74 192 Q73 201 69 208 L61 204 Z',
  calves: 'M59 214 Q66 218 73 213 L74 232 Q73 250 67 266 L63 264 Q61 245 57 233 Q55 220 59 214 Z',
};

function figure(view, regions) {
  return `<figure class="anatomy-figure">
    <svg class="anatomy-svg" viewBox="0 0 160 295" focusable="false">
      <g class="anatomy-silhouette">
        <path d="${half} Z"/><path d="${half} Z" transform="translate(160 0) scale(-1 1)"/>
        <path d="M65 21 Q65 6 80 6 Q95 6 95 21 L93 34 Q89 45 80 47 Q71 45 67 34 Z"/>
      </g>
      ${Object.entries(regions).map(([key, path]) => `<g class="anatomy-region" data-region="${key}">
        <path d="${path}"/><path d="${path}" transform="translate(160 0) scale(-1 1)"/>
      </g>`).join('')}
    </svg>
    <figcaption>${view}</figcaption>
  </figure>`;
}

// All markup inputs are local constants, never imported workout or user data.
maps.innerHTML = figure('Front', front) + figure('Back', back);
const regions = [...maps.querySelectorAll('.anatomy-region')];

function selectRegion(key) {
  const selected = buttons.find(button => button.dataset.region === key);
  if (!selected) return;
  for (const button of buttons) button.setAttribute('aria-pressed', String(button === selected));
  for (const region of regions) region.classList.toggle('is-selected', region.dataset.region === key);
  const view = key in front && key in back ? 'Front and back' : key in front ? 'Front' : 'Back';
  const label = `${selected.textContent} · ${view}`;
  if (selection.textContent !== label) selection.textContent = label;
}

anatomy.addEventListener('click', event => {
  const target = event.target.closest('[data-region]');
  if (target) selectRegion(target.dataset.region);
});

selectRegion('chest');
maps.hidden = controls.hidden = selection.hidden = false;
