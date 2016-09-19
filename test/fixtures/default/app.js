const Contentful = require('../../..')
const standard = require('reshape-standard')
const locals = {}

module.exports = {
  matchers: { html: '*(**/)*.sgr' },
  reshape: (ctx) => standard({ webpack: ctx, locals }),
  plugins: [new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk',
        filters: {
          limit: 1,
          order: 'sys.createdAt'
        }
      }
    ]
  })]
}
