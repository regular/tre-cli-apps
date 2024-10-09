module.exports = bin =>
  `${bin} --help ` +
  '\n' +

  `${bin} list ` +
  '[--config CONFIG] ' +
  '\n' +

  `${bin} deploy ` +
  '--revRoot MSGID|--first ' +
  '[--dryRun] ' +
  '[--remote MULTISERVER_ADDRESS] ' +
  '[--name NAME] ' +
  '[--descroption DESCRIPTION] ' +
  '[--config CONFIG] ' +
  '\n' +

  `${bin} invite ` +
  '--webapp MSGID ' +
  '[--name NAME] ' +
  '[--count NUMBER] ' +
  '[--compact] ' +
  '[--remote MULTISERVER_ADDRESS] ' +
  '[--config CONFIG] '
