const htime = require('human-time')

module.exports = function(app) {
  const {revision, revRoot} = app
  const {name, author, timestamp} = app
  const {branch, commit} = app.git
  console.error([
  `${revRoot}:${revision}`,
  `"${name}" by ${author}, deployed ${htime(new Date(timestamp))}`,
  `git branch: ${branch}, commit: ${commit}`,
  ''
  ].join('\n'))
}
