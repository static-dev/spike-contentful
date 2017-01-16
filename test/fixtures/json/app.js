const Contentful = require('../../..')
const htmlStandards = require('reshape-standard')
const locals = {}

module.exports = {
  matchers: { html: '*(**/)*.sgr' },
  reshape: (ctx) => htmlStandards({ webpack: ctx, locals }),
  plugins: [new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      // {
      //   name: 'cats',
      //   id: 'cat'
      // },
      {
        name: 'dogs',
        id: 'dog',
        json: 'dogs.json'
      }
    ],
    json: 'data.json'
  })]
}
