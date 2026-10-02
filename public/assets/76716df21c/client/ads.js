// Fills the ad slots the build placed (see src/lib/ads.js). A slot is filled
// only while it is visible (the sidebar is hidden on narrow screens), and a slot
// that cannot be filled (script blocked, no ad available) is removed, so no
// empty box is left behind.

import { pickSize, adsterraDoc } from '../lib/ads.js'

let adsense = null
function loadAdsense(client) {
  adsense ??= new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.async = true
    s.crossOrigin = 'anonymous'
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(client)}`
    s.onload = resolve
    s.onerror = reject
    document.head.append(s)
  })
  return adsense
}

function fill(slot) {
  const box = slot.querySelector('.ad-box')
  if (!box || !box.clientWidth) return
  const size = pickSize(slot.dataset.ad, JSON.parse(slot.dataset.adUnits), box.clientWidth)
  if (!size) { slot.remove(); return }   // too narrow for any size
  const [w, h] = size
  const id = JSON.parse(slot.dataset.adUnits)[`${w}x${h}`]
  slot.dataset.adFilled = `${w}x${h}`
  box.style.width = `${w}px`
  box.style.height = `${h}px`

  if (slot.dataset.adNetwork === 'adsense') {
    const ins = document.createElement('ins')
    ins.className = 'adsbygoogle'
    Object.assign(ins.style, { display: 'inline-block', width: `${w}px`, height: `${h}px` })
    ins.dataset.adClient = slot.dataset.adClient
    ins.dataset.adSlot = id
    box.append(ins)
    new MutationObserver(() => { if (ins.dataset.adStatus === 'unfilled') slot.remove() })
      .observe(ins, { attributes: true, attributeFilter: ['data-ad-status'] })
    loadAdsense(slot.dataset.adClient).catch(() => slot.remove())
    ;(window.adsbygoogle = window.adsbygoogle || []).push({})
  } else if (slot.dataset.adNetwork === 'adsterra') {
    const frame = document.createElement('iframe')
    frame.title = 'Advertisement'
    frame.width = w
    frame.height = h
    frame.loading = 'lazy'
    frame.setAttribute('sandbox', 'allow-scripts allow-popups allow-popups-to-escape-sandbox')
    frame.srcdoc = adsterraDoc(slot.dataset.adHost, id, size)
    box.append(frame)
  }
}

export function initAds() {
  const pending = () => [...document.querySelectorAll('.ad[data-ad]:not([data-ad-filled])')]
  if (!pending().length) return
  pending().forEach(fill)
  // A slot hidden at load (sidebar on a narrow window) fills if the window widens.
  let timer = 0
  addEventListener('resize', () => {
    clearTimeout(timer)
    timer = setTimeout(() => pending().forEach(fill), 250)
  })
}
