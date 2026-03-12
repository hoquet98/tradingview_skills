const tv = require('../index');
tv.getStrategyParams('USER;3f778e242a9b42d7992cd31da1320432').then(p => {
  p.filter(x => !x.isHidden).forEach(x => console.log(`${x.name} | ${x.type} | default=${x.defaultValue}`));
  process.exit(0);
}).catch(e => { console.error(e.message); process.exit(1); });
