# Spike Contentful Plugin

[![npm](http://img.shields.io/npm/v/spike-contentful.svg?style=flat)](https://badge.fury.io/js/spike-contentful) [![tests](http://img.shields.io/travis/static-dev/spike-contentful/master.svg?style=flat)](https://travis-ci.org/static-dev/spike-contentful) [![dependencies](http://img.shields.io/david/static-dev/spike-contentful.svg?style=flat)](https://david-dm.org/static-dev/spike-contentful)
[![coverage](http://img.shields.io/coveralls/static-dev/spike-contentful.svg?style=flat)](https://coveralls.io/github/static-dev/spike-contentful)

[Contentful CMS](https://www.contentful.com/) plugin for [spike](https://github.com/static-dev/spike)

> **Note:** This project is in early development, and versioning is a little different. [Read this](http://markup.im/#q4_cRZ1Q) for more details.

### Why should you care?

If you're using [Contentful](https://www.contentful.com/) and would like to pull your data for compilation into a [spike](https://github.com/static-dev/spike) static site, this will help you out.

### Installation

`npm install spike-contentful -S`

### Usage

This is a standard [webpack](https://webpack.github.io/) plugin, but is built for and intended to be used with [spike](https://github.com/static-dev/spike). You can include it in your spike project as such:

```js
// app.js
const Contentful = require('spike-contentful')
const htmlStandards = require('reshape-standard')
const locals = {}

module.exports = {
  plugins: [
    new Contentful({
      addDataTo: locals,
      accessToken: 'xxx',
      spaceId: 'xxx',
      contentTypes: [
        {
          name: 'posts',
          id: '633fTeiMaxxxxxxxxx',
        },
        {
          name: 'authors',
          id: '223gTahLaxxxxxxxxx',
        }
      ]
    })
  ],
  reshape: (ctx) => {
    return htmlStandards({
      locals
    })
  }
}
```

At a minimum, the `spike-contentful` plugin requires both `name` and `id` for `contentTypes`. The `name` corresponds with how you'd like to access it in your templates. The `id` is found listed under "Identifier" by logging into Contentful and clicking "APIs" then "Content model explorer".

Since Spike uses `reshape`, you can use a variety of different plugins to expose local variables to your html. We are using [reshape](https://github.com/reshape/reshape) along with [spike html standards](https://github.com/static-dev/spike-html-standards) here because it's the plugin provided in spike's default template, and also is currently the only plugin that provides the ability to run complex loops through objects.

In order to pass the data correctly, you must pass `spike-contentful` an object, which it will load the data onto when the compile begins under a `contentful` key. If you also pass the same object to whatever `reshape` plugin you are using in whatever manner it requires to make the data available in your html templates, the data will be present on that object before they start compiling. This is a slightly unconventional pattern for Javascript libraries, but in this situation it allows for maximum flexibility and convenience.

Once included, it will expose a `contentful` local to your jade files, which you can use to iterate through your content types. Based on the example above, the `posts` content type will be accessible through `contentful.posts`, as such:


```jade
// a template file
ul
  each(loop='post of contentful.posts')
    li {{ JSON.stringify(post) }}
```
For the sugar-free
``` html 
<ul>
	<each loop="post of contentful.blog">
		<li>{{ JSON.stringify(post) }}</li>
	</each>
</ul>
```

### Filters

#### Limit

To limit the number of results for a given content type:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      filters: {
        limit: 10
      }
    }
  ]
})
```

#### Order

To order results of a given content type:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      filters: {
        limit: 10,
        order: 'sys.createdAt'
      }
    }
  ]
})
```

### Transforms

Contentful returns a lot of associated data and, as a result, we include a way to clean it up. You also have the ability to pass your own custom `transform` option to each content type allowing you to transform the data however you like before it's sent to your views.

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      transform: (post) => {
        // do your transformation here...
        return post
      }
    }
  ]
})
```

This plugin ships with a default transform function that will run some basic cleanup. However, be warned that the transform will enter an infinite loop and crash if there are circular references within the data, which is not an uncommon occurance, so please be very careful utilizing this transform. To enable our default transform, you can pass `true` as such:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx',
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      transform: true
    }
  ]
})
```

If you'd like to use our default transform outside of the library, this is also available as an export. For example, you could include it and use it with client-side JS responses.

```js
const Contentful = require('spike-contentful')
console.log(Contentful.transform)
```

### Templates

Using the template option allows you to write objects returned from Contentful to single page templates. For example, if you are trying to render a blog as static, you might want each post returned from the API to be rendered as a single page by itself.

The `template` option is an object with `path` and `output` keys. The `path` is an absolute or relative path to a template to be used to render each item, and output is a function with the currently iterated item as a parameter, which should return a string representing a path relative to the project root where the single view should be rendered. For example:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx'
  contentTypes: [{
    name: 'posts',
    id: '633fTeiMaxxxxxxxxx',
    template: {
      path: 'templates/post.html',
      output: (post) => { return `posts/${post.id}.html` }
    }
  }]
})
```

Your template must use the `item` variable as seen below. Note: you also will need to prevent Spike from attempting to render your template file normally by adding your templates to Spike's `ignore` option, or adding an underscore to the file name.

```html
<p>{{item.title}}</p>
```

### JSON Output

Finally, if you'd like to have the output written locally to a JSON file so that it's cached locally, you can pass the name of the file, resolved relative to your project's output, as a `json` option to the plugin. For example:

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx'
  contentTypes: [{
    name: 'posts',
    id: '633fTeiMaxxxxxxxxx'
  }],
  json: 'data.json'
})
```

You may also choose to have the ouput written specifically for any content type :

```js
new Contentful({
  addDataTo: locals,
  accessToken: 'xxx',
  spaceId: 'xxx'
  contentTypes: [
    {
      name: 'posts',
      id: '633fTeiMaxxxxxxxxx',
      // JSON output expected for this content type
      json: 'posts.json'
    },
    {
      name: 'press',
      id: '4Em9bQeIQxxxxxxxxx'
      // No JSON output needed for this content type
    }
  ],
  // Save all content types data in one file
  json: 'alldata.json'
})
```

### Testing

To run the tests locally, you'll need to add a `test/.env` with your name and token values:

- `cp test/.env.sample test/.env`
- `accessToken` is derived from "APIs" > "Content Delivery API Keys" in the Contentful admin section.
- `spaceId` is also derived from "APIs" > "Content Delivery API Keys" in the Contentful admin section.

### License & Contributing

- Details on the license [can be found here](LICENSE.md)
- Details on running tests and contributing [can be found here](CONTRIBUTING.md)
