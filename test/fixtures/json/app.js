const Contentful = require('../../..')
const jade = require('posthtml-jade')
const locals = {}

module.exports = {
  matchers: { html: '**/*.jade' },
  posthtml: { plugins: [jade(locals)] },
  plugins: [new Contentful({
    accessToken: process.env.accessToken,
    spaceId: process.env.spaceId,
    addDataTo: locals,
    contentTypes: [
      {
        name: 'blogs',
        id: '633fTeiMaQwE44OsIqSimk'
      }
    ],
    json: 'data.json'
  })]
}
