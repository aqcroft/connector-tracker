const QR_CONNECTOR_DATA={
'CN-J0HD':'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+YG7z+AQXoolQQC6YA0q6AXQh63XQC6eYBy6AQWDGNQQD+qqqr+AAEkoUAAAPWtNzEAFO9Nh9AB6NdvtYAHmJTUhwACfBEWEAPsLbFlAAetN7w4AJOqEwtwAWNCGecAfBFFTHABqP6R5wAWslnRBQAL1e+mKADvFx2EQCzTDH6AAcFNwJ5gBjGFvdqAaityMSAAfgohU8ADDSwXfQDKRP0PmAAHUn9GAD+8dcq4AQUx8HFQC6oaUP8AXSadTaAC6bXeyMAQSzikdgD+cgrUOAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA=',
'CN-L8RY':'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD+yMS7+AQUrdaQQC6Mz+66AXVc7+XQC68YRy6AQUZWfQQD+qqqr+AAAsgUAAASfoiZ2ASoOb3KwCvqsWSuANLneZMQBHOGJfcATA2EqawCOnBtiqAHEh9ZkwAavQmecANO3NBVQCfbNfPGAWoNhRBQBmcSjLmAFF/DAyAAOucgF+ABsQbkUAB7ONmUgAGNSMzuwCHiozG+APLZ5eWQDaJL0PmAAFG1vEQD+axqauAQRws3FQC6HnZvwAXVEtlswC6AoBNyAQT6MJwAD+RIidGAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA='};
let qrActiveConnectorId='';
function qrUrl(item){const c=String(item?.code||'').trim().toUpperCase();return /^CN-[A-Z0-9]{4,20}$/.test(c)?'https://connectors.uw.co.uk/'+c:''}
function connectorQrShortcut(){return qrUrl(connector())?'<button type="button" class="cat-show-qr" data-show-cat-qr><span class="cat-qr-icon">▦</span><span><strong>Show Connector QR code</strong><small>Let someone scan, or share the link</small></span><b>→</b></button>':''}
function qrMarkup(item){
const s=QR_CONNECTOR_DATA[String(item?.code||'').toUpperCase()];
if(!s)return '<p>QR image not yet configured. Use the official link below.</p>';
const b=atob(s);let p='';for(let y=0;y<45;y++)for(let x=0;x<45;x++){const i=y*45+x;if(b.charCodeAt(i>>3)&(128>>(i&7)))p+='M'+x+' '+y+'h1v1h-1z'}
return '<div class="cat-qr-image" role="img" aria-label="QR code for '+escapeHtml(item.name)+'"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 45 45" shape-rendering="crispEdges" aria-hidden="true"><rect width="45" height="45" fill="white"/><path d="'+p+'" fill="black"/></svg><span class="cat-qr-logo">'+logoMarkup(item)+'</span></div>';
}
function qrOpen(){
const item=connector();if(!item||!hasAccess(item.id))return;const url=qrUrl(item);if(!url)return;
qrActiveConnectorId=item.id;closeModal();
openModal('Share '+escapeHtml(item.name),'<div class="cat-qr-details"><p>Let someone scan your screen, or share this Connector link.</p>'+qrMarkup(item)+'<strong>'+escapeHtml(item.name)+'</strong><p class="cat-qr-url">'+escapeHtml(url)+'</p><div class="cat-qr-actions"><button type="button" class="btn btn-primary" data-copy-cat-qr>Copy link</button><button type="button" class="btn btn-secondary" data-share-cat-qr>Share</button><a class="btn btn-secondary" href="'+escapeHtml(url)+'" target="_blank" rel="noopener noreferrer">Open form ↗</a></div></div>');
}
async function qrShare(share){const item=connector(qrActiveConnectorId);if(!item||!hasAccess(item.id))return;const url=qrUrl(item);if(!url)return;
if(share&&typeof navigator.share==='function'){try{await navigator.share({title:item.name+' Connector',url});return}catch(e){if(e?.name==='AbortError')return}}
try{await navigator.clipboard.writeText(url);showToast('Connector link copied')}catch(e){showToast('Long-press the displayed link to copy it')}
}
document.addEventListener('click',e=>{const b=e.target.closest('[data-show-cat-qr],[data-copy-cat-qr],[data-share-cat-qr]');if(!b)return;
e.preventDefault();e.stopImmediatePropagation();
if(b.hasAttribute('data-show-cat-qr'))qrOpen();else void qrShare(b.hasAttribute('data-share-cat-qr'));
},true);
