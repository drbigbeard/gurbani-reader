#!/usr/bin/env node
const surfaces = {
  paper:{ bg:'#fbf7ed', panel:'#fffdf7', ink:'#1d2925', muted:'#617069' },
  sepia:{ bg:'#f3e6cc', panel:'#faefd9', ink:'#342a1f', muted:'#74644f' },
  light:{ bg:'#ffffff', panel:'#ffffff', ink:'#17201d', muted:'#59655f' },
  dark:{ bg:'#17201d', panel:'#202c28', ink:'#edf4f0', muted:'#aec0b7' },
  black:{ bg:'#000000', panel:'#0c0c0c', ink:'#f1f1f1', muted:'#aaaaaa' }
};
const accents = {
  light:{ indigo:{accent:'#4657a8',soft:'#eceefe'}, burgundy:{accent:'#88405a',soft:'#f7eaf0'}, slate:{accent:'#49616c',soft:'#eaf0f2'}, forest:{accent:'#22664f',soft:'#e6f1ed'} },
  dark:{ indigo:{accent:'#aeb8ff',soft:'#292d49'}, burgundy:{accent:'#f0abc3',soft:'#492b36'}, slate:{accent:'#b9d4df',soft:'#293b42'}, forest:{accent:'#91d7bd',soft:'#233e34'} }
};
const assert = (condition, message) => { if (!condition) throw new Error(message); console.log(`PASS  ${message}`); };
for (const [theme, colours] of Object.entries(surfaces)) {
  for (const surface of ['bg','panel']) {
    assert(ratio(colours.ink, colours[surface]) >= 4.5, `${theme} ink meets WCAG AA on ${surface}`);
    assert(ratio(colours.muted, colours[surface]) >= 4.5, `${theme} secondary text meets WCAG AA on ${surface}`);
    for (const [name, palette] of Object.entries(theme === 'dark' || theme === 'black' ? accents.dark : accents.light)) {
      assert(ratio(palette.accent, colours[surface]) >= 4.5, `${theme}/${name} controls meet WCAG AA on ${surface}`);
      assert(ratio(colours.ink, palette.soft) >= 4.5, `${theme}/${name} selected rows retain readable primary text`);
      assert(ratio(palette.accent, palette.soft) >= 4.5, `${theme}/${name} accent labels remain readable on soft surfaces`);
      const onAccent = theme === 'dark' || theme === 'black' ? '#111827' : '#ffffff';
      assert(ratio(onAccent, palette.accent) >= 4.5, `${theme}/${name} solid controls use a readable on-accent colour`);
    }
  }
}
console.log('\nv0.16 RC2 semantic contrast audit passed.');

function ratio(left,right){const [a,b]=[luminance(left),luminance(right)].sort((x,y)=>y-x);return (a+.05)/(b+.05);}
function luminance(hex){const raw=hex.slice(1);const rgb=[0,2,4].map(at=>Number.parseInt(raw.slice(at,at+2),16)/255).map(value=>value<=.04045?value/12.92:Math.pow((value+.055)/1.055,2.4));return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2];}
