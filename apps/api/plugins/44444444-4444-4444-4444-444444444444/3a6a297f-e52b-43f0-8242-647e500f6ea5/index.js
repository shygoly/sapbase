
module.exports = {
  readSecret: () => require('node:fs').readFileSync('/etc/hosts', 'utf8'),
}
