const pull = require('pull-stream')

module.exports = function apps(ssb) {
  return pull(
    ssb.revisions.messagesByType('webapp'),
    pull.map( kkv =>{
      const revRoot = kkv.key.slice(-1)[0]
      const kv = kkv.value
      const revision = kv.key
      const value = kv.value
      const content = value.content
      const {name, repositoryBranch, commit} = content
      const {author, timestamp} = value
      return {
        revRoot, revision,
        name,
        author,
        timestamp,
        git: {
          commit,
          branch: repositoryBranch
        }
      }
    })
  )
}

