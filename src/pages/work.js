import React from "react"
import { graphql } from "gatsby"

import Layout from "../components/layout"
import BioComponent from "../components/Bio"
import SEO from "../components/seo"
import { rhythm, scale } from "../utils/typography"

const NotFoundPage = ({ data, location }) => {
  const siteTitle = data.site.siteMetadata.title

  return (
    <Layout location={location} title={siteTitle}>
        <SEO title="Work" />
        <BioComponent />
        <h1>Work</h1>
        <article>
            <ul>
                <li><a href="#pgp-site">Princeton Gerrymandering Project website (2020-now)</a></li>
                <li><a href="#openprecincts">OpenPrecincts (2020-now)</a></li>
                <li><a href="#sharedstreets">SharedStreets Road Closure tool (2018-2019)</a></li>
                <li><a href="#pavement-mgmt">Pavement (curb management tool, 2018)</a></li>
                <li><a href="#pavement-viewer">Pavement (curb rules viewer, 2018)</a></li>
                <li><a href="#sust-dashboard">Sustainable Jersey hackathon (2017)</a></li>
                <li><a href="#appnexus">AppNexus (2015-2018)</a></li>
            </ul>
        </article>
        <article>
            <header>
                <h2
                    id={`pgp-site`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    Princeton Gerrymandering Project website
                </h2>
            </header>
            <section>
                <h4><a href="https://gerrymander.princeton.edu">visit the site</a></h4>
                <h5>2020 — now</h5>
                <h5>React, Gatsby, Netlify Functions, Airtable</h5>
                <p>
                    When I joined the team in early 2020 the site was a React app with data stored as plaintext, JSON, and a Firebase database, 
                    plus a separate Django app iframed/proxied in.
                    The team found it difficult for the site's content to be updated.
                    Going into the 2021 redistricting cycle, I knew the site would be important for the team + rotating cast of students to update 
                    content behind static pages, interactive pieces, and any advanced SPA-like functionality we wanted to add.
                </p>
                <p>
                    I decided to redesign and rewrite the site as a new React app using Gatsby, which I deployed on Netlify. I led an undergrad to work an initial prototype, after which I took ownership.
                    I brought over the <a href="http://gerrymander.princeton.edu/tests">existing JSON-driven interactive page </a>
                     as-is with no loss of functionality.
                    To support an <a href="https://participant.com/campaigns/slaythedragon">marketing partnership</a>, I used Netlify Functions to deploy an RSS feed.
                    I sunset the Firebase- and Django-driven pages, replacing them with static Markdown and an Airtable integration respectively.
                    
                </p>
                <p>
                    The Airtable integration let the team easily launch new interactive maps like a map showing how various states'
                    redistricting processes would be affected by delays in the 2020 Census—
                    it's been shared across <a href="https://twitter.com/search?q=https%3A%2F%2Fgerrymander.princeton.edu%2Fredistricting-timeline-alert-map&src=typed_query">election twitter</a>
                    and <a href="https://www.dailykos.com/stories/2021/3/26/2023090/-Voting-Rights-Roundup-GOP-passes-Georgia-s-most-far-reaching-voting-restriction-law-since-Jim-Crow">political news</a>.
                    The team will use the site for further interactive
                    research reports and data visualization as redistricting commences.
                </p>
                <a href="https://gerrymander.princeton.edu/redistricting-timeline-alert-map">
                    <img src="/static/96a8b5993177d730ced8b143744d9087/redistricting-timeline-map.png" />
                </a>
            </section>
        </article>
        <article>
            <header>
                <h2
                    id={`openprecincts`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    OpenPrecincts
                </h2>
            </header>
            <section>
                <h4><a href="https://openprecincts.org">visit the site</a></h4>
                <h5>2020 — now</h5>
                <h5>Python, Django, Mapbox</h5>
                <p>
                    OpenPrecincts is a project hosting precinct-level electoral geospatial data. I began leading engineering in spring 2020. 
                    I added the ability to read info about, download, and view multiple electoral result maps. 
                    In the process, I had our team join the Mapbox Community program, and
                    <a href="https://www.mapbox.com/webinars/election-maps-princetongerry"> gave a talk on it as part of the Mapbox 
                    Elections Challenge speaker series</a>.
                </p>
                <a href="https://openprecincts.org/tx">
                    <img src="/static/62ffafc499d7f2da798060f697a2e59f/openprecincts.png" />
                </a>
            </section>
        </article>
        <article>
            <header>
                <h2
                    id={`sharedstreets`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    SharedStreets Road Closure Tool
                </h2>
            </header>
            <section>
                <h4><a href="http://roadclosures-test.sharedstreets.io/">visit the site</a> |
                <a href="https://github.com/sharedstreets/sharedstreets-road-closure-ui">github</a>
                </h4>
                
                <h5>2018-2019</h5>
                <h5>React, Redux, Mapbox</h5>
                <p>
                    At SharedStreets, I designed and built a web app with React/Redux using Mapbox to manage road closures and worked with PANYNJ
                    to test it in their Agency Operations Center.
                    The app used the SharedStreets referencing system to make the data easily translatable
                    between various government and commerical base maps. 
                </p>
                <p>
                    I <a href="https://www.youtube.com/watch?v=ROemNM73E2c"> gave a talk on it at State of the Map US 2019 </a>
                    and at <a href="https://www.youtube.com/watch?v=LUbZs_Kv-Pg">a Transit Techies meetup</a>.
                </p>
                <a href="http://roadclosures-test.sharedstreets.io/">
                    <img src="/static/d9d84dc8b7de82f9e592031a2bd38df2/sharedstreets.png" />
                </a>
            </section>
        </article>
        <article>
            <header>
                <h2
                    id={`pavement-mgmt`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    Pavement (curb management tool)
                </h2>
            </header>
            <section>
                <h4><a href="https://drive.google.com/file/d/1NfhtqkfGBOVULoaAPGoYT7ZFjhY0DLWI/view">video demo</a> |
                <a href="https://drive.google.com/file/d/1m3_IEqpjnn2kx-yPdHXO43zOBdwegGUc/view">one pager</a> |
                <a href="https://github.com/teampavement/pavement-dashboard">github</a>
                </h4>
                
                <h5>2018</h5>
                <h5>React, Redux, Leaflet, PostGIS</h5>
                <p>
                    With one teammate, I built a parking/curb management web app. I wrote all of the frontend code (react, redux)
                    and did some geospatial data munging (postgis). 
                    With another teammate, I called cities until we found a partner in, and ran a pilot program w/, the City of Asbury Park.
                    Ultimately we didn't find a strong product-market fit and disbanded the project. I joined SharedStreets shortly thereafter.
                </p>
                {/* <a href="https://openprecincts.org/tx"> */}
                    <img src="/static/32f0533a6f74fa537c1ef36650a9b933/pavement-mgmt.png" />
                {/* </a> */}
            </section>
        </article>
        <article>
            <header>
                <h2
                    id={`pavement-viewer`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    Pavement (curb rules viewer)
                </h2>
            </header>
            <section>
                <h4><a href="https://trypavement.com/">visit the site</a> |
                <a href="https://github.com/teampavement/pavement-sms">github</a>
                </h4>
                
                <h5>2018</h5>
                <h5>React, Leaflet</h5>
                <p>
                    With one teammate, built a web map of all the parking rules in Downtown Jersey City.
                    I wrote all of the frontend code (react + a leaflet map) to visualize the data manually gathered by my teammate.
                </p>
                <p>
                    To support data collection, <a href="https://github.com/indraneel/parking-sign-builder">
                        I wrote a smaller tool to help generate properly formatted JSON</a>.
                </p>
                <a href="https://trypavement.com/">
                    <img src="/static/f6d27e19b54a50248f172178cf41362e/pavement-viewer.png" />
                </a>
            </section>
        </article>
        <article>
            <header>
                <h2
                    id={`sust-dashboard`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    Sustainable Jersey hackathon
                </h2>
            </header>
            <section>
                <h4><a href="https://blog.grdodge.org/2017/04/19/sustainable-jersey-15-sustainable-solutions-to-community-challenges/">
                    read the story</a> |
                <a href="https://www.slideshare.net/rickytrent/coding-for-community-team-dashability">
                    see the slides | 
                </a>
                <a href="https://github.com/indraneel/sustainability-dashboard">github</a>
                </h4>
                
                <h5>2017</h5>
                <h5>React, Redux</h5>
                <p>
                    Won 2nd place in a civic hackathon held by <a href="https://www.sustainablejersey.com/">Sustainable Jersey</a> in 2017.
                    I wrote the UI of a dashboard for a local township to track their sustainability goals. Didn't get used but it was, for me, 
                    a good entry into civic tech.
                </p>
                <img src="/static/11bfcac58409ca12f0c2f03cc5cf8184/sust-dashboard.png" />
            </section>
        </article>
        <article>
            <header>
                <h2
                    id={`appnexus`}
                    style={{marginBottom: rhythm(1 / 4)}}>
                    AppNexus (assorted projects)
                </h2>
            </header>
            <section>
                <h5>2015-2018</h5>
                <h5>React, Redux</h5>
                <p>
                    Worked on a few enterprise web apps to start my career. They're not public/
                    are probably defunct now but you can read some archived product blog posts:
                    <ul>
                        <li>
                            <a href="https://web.archive.org/web/20180514073045/http://productblog.appnexus.com/rapid-reliable-creative-previewing-2/">
                            Rapid, Reliable Creative Previewing</a>
                        </li>
                        <li>
                            <a href="https://web.archive.org/web/20190127133700/https://productblog.appnexus.com/">
                                Native advertising tools for Buyers and Sellers
                            </a>
                        </li>
                    </ul>
                </p>
                <img src="/static/1298424fbcb01359304be7b42f5b8242/appnexus.png" />
            </section>
        </article>
    </Layout>
  )
}

export default NotFoundPage

export const pageQuery = graphql`
  query {
    site {
      siteMetadata {
        title
      }
    }
    allFile(filter: {sourceInstanceName: {eq: "assets"}}) {
        nodes {
          id
          publicURL
          name
        }
      }
  }
`
