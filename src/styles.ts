export const styles = `
:host{font:16px/1.5 system-ui,sans-serif;color:#172033;--s2b-color:#2457d6}
*{box-sizing:border-box}
button,a{font:inherit}
button{cursor:pointer;background:var(--s2b-color);color:#fff;border:2px solid currentColor;border-radius:6px;padding:.65rem 1rem}
button:focus-visible,a:focus-visible{outline:3px solid #111;outline-offset:3px}
a{color:#1745ad}
.backdrop{position:fixed;inset:0;background:#0009;z-index:2147483647;display:flex;align-items:center;justify-content:center;padding:24px}
.panel{background:#fff;border-radius:12px;width:min(960px,100%);height:min(800px,90dvh);display:flex;flex-direction:column;overflow:auto;box-shadow:0 12px 48px #0005}
header{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px 16px}
h2{font-size:1.15rem;margin:0}
.content{display:flex;flex-direction:column;flex:1;min-height:0;background:#fff}
.inline{border:1px solid #ddd;border-radius:8px;min-height:480px}
iframe{border:0;width:100%;flex:1;min-height:240px;background:#fff}
.inline iframe{min-height:480px}
p,footer{margin:0;padding:12px 16px}
[hidden]{display:none!important}
@media(max-width:640px){.backdrop{padding:0}.panel{width:100%;height:100%;height:100dvh;border-radius:0}}
`;
