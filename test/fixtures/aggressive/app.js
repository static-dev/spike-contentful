const Contentful = require('../../..')
const standard = require('reshape-standard')
const locals = {}

module.exports = {
  reshape: standard({ locals }),
  plugins: [new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    aggressiveRefresh: true,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'cats',
        id: 'cat',
        filters: {
          limit: 1,
          order: 'sys.createdAt'
        }
      }
    ]
  })]
}
