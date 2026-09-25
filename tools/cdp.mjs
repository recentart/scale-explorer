// Tiny Chrome DevTools Protocol client for the dev tools (browser tests and
// share images). Starts headless Chrome and talks to one page over WebSocket.
// No npm dependencies; needs Node 22+ for the global WebSocket.

import { spawn } from 'node:child_process'
import { existsSync } from 'node:fs'
import { rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
]

export const sleep = ms => new Promise(r => setTimeout(r, ms))

export async function launchChrome({ port = 9333 } = {}) {
  const exe = process.env.CHROME || CANDIDATES.find(p => existsSync(p))
  if (!exe) throw new Error('Chrome not found; set the CHROME environment variable')
  const profile = path.join(os.tmpdir(), `se-chrome-${process.pid}-${port}`)
  const proc = spawn(exe, [
    '--headless=new', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
    '--no-first-run', '--no-default-browser-check', '--disable-gpu', '--hide-scrollbars', '--mute-audio', 'about:blank',
  ], { stdio: 'ignore' })

  for (let i = 0; ; i++) {
    try { await (await fetch(`http://127.0.0.1:${port}/json/version`)).json(); break } catch {
      if (i > 150) throw new Error('Chrome did not start')
      await sleep(100)
    }
  }
  const target = await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`, { method: 'PUT' })).json()
  const ws = new WebSocket(target.webSocketDebuggerUrl)
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej })

  let id = 0
  const pending = new Map()
  const listeners = new Set()
  ws.onmessage = ev => {
    const msg = JSON.parse(ev.data)
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id)
      pending.delete(msg.id)
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result)
    } else if (msg.method) for (const l of listeners) l(msg)
  }
  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const n = ++id
    pending.set(n, { resolve, reject })
    ws.send(JSON.stringify({ id: n, method, params }))
  })
  const evaluate = async expr => {
    const r = await send('Runtime.evaluate', { expression: expr, awaitPromise: true, returnByValue: true })
    if (r.exceptionDetails) throw new Error(`eval failed: ${r.exceptionDetails.exception?.description || r.exceptionDetails.text}\n${expr.slice(0, 200)}`)
    return r.result.value
  }
  const close = async () => {
    ws.close()
    proc.kill()
    await sleep(300)
    await rm(profile, { recursive: true, force: true }).catch(() => {})
  }
  return { send, evaluate, listeners, close }
}
