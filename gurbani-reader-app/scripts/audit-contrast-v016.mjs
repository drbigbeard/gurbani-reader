#!/usr/bin/env node
const surfaces = {
  paper:{ bg:'#fbf7ed', panel:'#fffdf7', ink:'#1d2925', muted:'#617069' },
  sepia:{ bg:'#f3e6cc', panel:'#faefd9', ink:'#342a1f', muted:'#74644f' },
  light:{ bg:'#ffffff', panel:'#ffffff', ink:'#17201d', muted:'#59655f' },
  dark:{ bg:'#17201d', panel:'#202c28', ink:'#edf4f0', muted:'#aec0b7' },
  black:{ bg:'#000000', panel:'#0c0c0c', ink:'#f1f1f1', muted:'#aaaaaa' }
};
const accents = {
  light:{ indigo:'#4657a8', burgundy:'#88405a', slate:'#49616c', forest:'#22664f' },
  dark:{ indigo:'#aeb8ff', burgundy:'#f0abc3', slate:'#b9d4df', forest:'#91d7bd' }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };
for (const [theme, colours] of Object.entries(surfaces)) {
  for (const surface of ['bg','panel']) {
    assert(ratio(colours.ink, colours[surface]) >= 4.5, `${theme} ink meets WCAG AA on ${surface}`);
    assert(ratio(colours.muted, colours[surface]) >= 4.5, `${theme} secondary text meets WCAG AA on ${surface}`);
    for (const [name, accent] of Object.entries(theme === 'dark' || theme === 'black' ? accents.dark : accents.light)) assert(ratio(accent, colours[surface]) >= 4.5, `${theme}/${name} controls meet WCAG AA on ${surface}`);
  }
}
console.log('\nv0.16 contrast audit passed.');

function ratio(left,right){const [a,b]=[luminance(left),luminance(right)].sort((x,y)=>y-x);return (a+.05)/(b+.05);}
function luminance(hex){const raw=hex.slice(1);const rgb=[0,2,4].map(at=>Number.parseInt(raw.slice(at,at+2),16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
