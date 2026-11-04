
let context = null
module.exports = {
  initialize: (ctx) => { context = ctx },
  compute: (a, b) => a + b,
  sayHi: async () => {
    await context.log('hello from plugin')
    return 'hi'
  },
}
