const {spawn} = require('child_process')
const minimist = require('minimist')
const debug = require('debug')('tre-cli-apps')

const COMMANDS = {
  'deploy': {bin: 'deploy.js', desc: 'deploy a bundled webapp to an ssb network'},
  'list': {bin: 'list.js', desc: 'find webapps on a network'},
  'invite': {bin: 'invite.js', desc: 'create an invite code for an application'},
}

module.exports = function(args, cerr, cb) {
  const argv = minimist(args)
  debug('parsed argv %o', argv)
  const bin = argv['run-by-tre-cli'] ? 'tre apps' : 'tre-cli-apps'
  if (argv.help || !argv._.length) {
    if (argv.help) {
      console.log(require('./help')(bin))
      return cb()
    } else {
      console.error(require('./usage')(bin))
      return cb(new Error('Invalid number of arguments'))
    }

    if (parsed.version) return version(cb)
  }

  const command = COMMANDS[args[0]]
  if (!command) {
    return cb(new Error(`Unknown sub-command: ${argv[0]}`))
  }
  runCommand(command.bin, args.slice(1), cb)

  function version(cb) {
    cerr(`tre-cli-apps ${require(__dirname + '/package.json').version}`)
    cb()
  }

  function runCommand(bin, argv, cb) {
    debug(`Running ${bin} ${argv.join(' ')}`)
    const child = spawn(`${__dirname}/bin/${bin}`,
      argv.concat(['--run-by-tre-cli']), {
        env: process.env,
        stdio: 'inherit'
      }
    )
    child.on('exit', code => {
      if (code == 0) return cb()
      cb(new Error(`${bin} exited with code ${code}`))
    })
  }
}
