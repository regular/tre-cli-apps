#!/usr/bin/env node

const code = require('.')(process.argv.slice(2), cerr, err =>{
  if (err) {
    cerr(err.message)
    process.exit(1)
  }
  process.exit(0)
})

function cerr() {
  console.log.apply(this, Array.from(arguments))
}
