module.exports = bin =>
`USAGE

${require('./usage')(bin)}

DESCRIPTION

${bin} list lists all messages of type 'webapp' that can be found on the network defined by the config file .trerc (or, if --config is used, some other config file). A server must be running for this to work.

${bin} deploy either uploads a new version of an existing webapp, or publishes a new one. To update, you need to specify the revisionRoot (original message id) of an existing webapp with --revRoot MSGID. To publish an entirely new webapp, you need to use --first. ${bin} deplay reads a bundled application (the output of tre-compile) from STDIN.

${bin} invite creates an invite code for a deployed application. tre invite codes contain a traditional ssb pub invite and additional information: what app to open, what feed to follow and what name to use. If such an invite code is used in Bay of Plenty, the invited person will automatically follow the feed that created the invite (per default defined by .tre/secret) in addition to the pub that generated the invite code. He invitee will then be redirected to the webapp specified in the invite code (use --webapp to pick the app). if --name is used, the invited person will post an about message with the given name. Bay of Plenty only understands invite codes in the --compact format, the defailt output format is JSON.

  --remote             pick a remote peer to talk to (also see FILES)
  --config CONFIG      path to JSON file with caps.shs, defaults to .trerc (see FILES)
  --help               show help

FILES
  
  If --config CONFIG is not given, ${bin} looks for a file named .trerc in the current directory or above. (and other locations, see rc on npm for details)

  if --remote is not given ${bin} looks for a file named .tre/remotes. This JSON-formatted file maps names to multi-server addresses. If there is more than one address in this file, --remote NAME must be used to select one. This only applies to invite and deploy.

EXAMPLES

  tre compile index.js > app.html
  ${bin} deploy --first < app.html --dryRun
  ${bin} list --comfig ../myapp/.trerc
  ${bin} invite --webapp %abc --remote mypub --count 20
`
