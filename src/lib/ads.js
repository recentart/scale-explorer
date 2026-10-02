// Ads. Off until data/site.json "ads" names a network and its IDs; until then
// the build outputs no ad markup, no ad scripts and keeps the strict
// Content-Security-Policy. Shared by the build (markup) and the browser (filling).
//
// Two small places only, both away from the drawings:
//   bottom   one slim banner above the footer: 728×90, or 320×50 on narrow screens
//   sidebar  one 300×250 box in the right column of object pages, wide screens only
// Each is labelled "Advertisement". No pop-ups, pop-unders, sticky or anchor
// ads, interstitials or auto ads are ever loaded by this code.

import { esc } from './render.js'

// Sizes per place, largest first; the first that fits the slot's width is used.
export const AD_SIZES = {
  bottom: [[728, 90], [320, 50]],
  sidebar: [[300, 250]],
}

export const NETWORKS = {
  adsense: { name: 'Google AdSense', privacy: 'https://policies.google.com/technologies/ads' },
  adsterra: { name: 'Adsterra', privacy: 'https://adsterra.com/privacy-policy/' },
}

const sizeKey = ([w, h]) => `${w}x${h}`

// Normalised settings, or null when ads are off. Half-filled or mistyped
// settings throw, so a typo fails the build instead of shipping broken boxes.
//   AdSense:  { network: 'adsense', client: 'ca-pub-…', slots: { bottom: '<ad unit id>', sidebar: '<ad unit id>' } }
//   Adsterra: { network: 'adsterra', host: '<banner script host>', slots: { bottom: { '728x90': '<key>', '320x50': '<key>' }, sidebar: { '300x250': '<key>' } } }
export function adSettings(raw) {
  if (!raw || !raw.network) return null
  const fail = msg => { throw new Error(`data/site.json ads: ${msg}`) }
  const { network } = raw
  if (!NETWORKS[network]) fail(`network must be one of ${Object.keys(NETWORKS).join(', ')} (or empty for no ads)`)
  if (network === 'adsense' && !/^ca-pub-\d{10,20}$/.test(raw.client || '')) fail('client must look like ca-pub-1234567890123456')
  if (network === 'adsterra' && !/^[a-z0-9-]+(\.[a-z0-9-]+)+$/i.test(raw.host || '')) fail('host must be the banner script host, e.g. www.highperformanceformat.com')
  const idOk = network === 'adsense' ? /^\d{6,20}$/ : /^[0-9a-f]{32}$/
  const slots = {}
  for (const [place, value] of Object.entries(raw.slots || {})) {
    if (!value) continue
    if (!AD_SIZES[place]) fail(`unknown slot "${place}" (use ${Object.keys(AD_SIZES).join(', ')})`)
    const units = {}
    for (const size of AD_SIZES[place]) {
      const id = typeof value === 'string' ? value : value[sizeKey(size)]
      if (!id) continue
      if (!idOk.test(id)) fail(`slots.${place} ${sizeKey(size)}: "${id}" is not a ${network} ${network === 'adsense' ? 'ad unit id' : 'banner key'}`)
      units[sizeKey(size)] = id
    }
    if (typeof value === 'object') for (const k of Object.keys(value)) if (!units[k] && value[k]) fail(`slots.${place}: size ${k} is not used here (use ${AD_SIZES[place].map(sizeKey).join(', ')})`)
    if (Object.keys(units).length) slots[place] = units
  }
  if (!Object.keys(slots).length) fail('network is set but no slots have IDs')
  return { network, client: raw.client || '', host: raw.host || '', slots }
}

// Markup for one place, or '' when that place has no ad. The browser fills it.
export function adSlot(ads, place) {
  const units = ads?.slots[place]
  if (!units) return ''
  return `<aside class="ad ad-${place}" aria-label="Advertisement" data-ad="${place}" data-ad-network="${esc(ads.network)}"` +
    `${ads.client ? ` data-ad-client="${esc(ads.client)}"` : ''}${ads.host ? ` data-ad-host="${esc(ads.host)}"` : ''}` +
    ` data-ad-units="${esc(JSON.stringify(units))}"><p class="ad-label">Advertisement</p><div class="ad-box"></div></aside>`
}

// The size to show in a slot this wide, or null when none fits.
export function pickSize(place, units, width) {
  return (AD_SIZES[place] || []).find(s => s[0] <= width && units[sizeKey(s)]) || null
}

// An Adsterra banner runs in its own sandboxed frame: it can open the ad's page
// when clicked but cannot redirect or script this page.
export function adsterraDoc(host, key, [w, h]) {
  const opts = JSON.stringify({ key, format: 'iframe', height: h, width: w, params: {} })
  return `<!doctype html><html><head><style>html,body{margin:0;overflow:hidden}</style></head><body>` +
    `<script>atOptions = ${opts}</script><script src="https://${host}/${key}/invoke.js"></script></body></html>`
}
