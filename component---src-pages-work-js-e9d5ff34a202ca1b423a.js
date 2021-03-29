(window.webpackJsonp=window.webpackJsonp||[]).push([[5],{Ofmp:function(e,t,a){"use strict";a.r(t);var n=a("q1tI"),r=a.n(n),l=a("Bl7J"),i=a("Wbzz"),o=a("p3AD"),s=function(){var e=Object(i.c)("1482059472").site.siteMetadata.social;return r.a.createElement("div",{style:{display:"flex",flexDirection:"column",marginBottom:Object(o.a)(1.5)}},r.a.createElement("div",null,r.a.createElement(i.a,{to:"/work"},"work")),r.a.createElement("div",null,r.a.createElement("a",{href:"https://github.com/indraneel",target:"_blank"},"github")),r.a.createElement("div",null,r.a.createElement("a",{href:"https://twitter.com/"+e.twitter,target:"_blank"},"twitter")))},c=a("vrFN");t.default=function(e){var t=e.data,a=e.location,n=t.site.siteMetadata.title;return r.a.createElement(l.a,{location:a,title:n},r.a.createElement(c.a,{title:"Work"}),r.a.createElement(s,null),r.a.createElement("h1",null,"Work"),r.a.createElement("article",null,"This list is in reverse chronological order. So far my career has gone from ad tech to non-profit tech (transit and elections, so far).",r.a.createElement("ul",null,r.a.createElement("li",null,r.a.createElement("a",{href:"#pgp-site"},"Princeton Gerrymandering Project website (2020-now)")),r.a.createElement("li",null,r.a.createElement("a",{href:"#openprecincts"},"OpenPrecincts (2020-now)")),r.a.createElement("li",null,r.a.createElement("a",{href:"#sharedstreets"},"SharedStreets Road Closure tool (2018-2019)")),r.a.createElement("li",null,r.a.createElement("a",{href:"#pavement-mgmt"},"Pavement (curb management tool, 2018)")),r.a.createElement("li",null,r.a.createElement("a",{href:"#pavement-viewer"},"Pavement (curb rules viewer, 2018)")),r.a.createElement("li",null,r.a.createElement("a",{href:"#sust-dashboard"},"Sustainable Jersey hackathon (2017)")),r.a.createElement("li",null,r.a.createElement("a",{href:"#appnexus"},"AppNexus (2015-2018)")))),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"pgp-site",style:{marginBottom:Object(o.a)(1/4)}},"Princeton Gerrymandering Project website")),r.a.createElement("section",null,r.a.createElement("h4",null,r.a.createElement("a",{href:"https://gerrymander.princeton.edu"},"visit the site")),r.a.createElement("h5",null,"2020 — now"),r.a.createElement("h5",null,"React, Gatsby, Netlify Functions, Airtable"),r.a.createElement("p",null,"When I joined the team in early 2020 the site was a React app with data stored as plaintext, JSON, and a Firebase database, plus a separate Django app iframed/proxied in. The team found it difficult for the site's content to be updated. Going into the 2021 redistricting cycle, I knew the site would be important for the team + rotating cast of students to update content behind static pages, interactive pieces, and any advanced application functionality we wanted to add."),r.a.createElement("p",null,"I decided to redesign and rewrite the site as a new React app using Gatsby, which I deployed on Netlify. I led an undergrad to work an initial prototype, after which I took ownership. I brought over the ",r.a.createElement("a",{href:"http://gerrymander.princeton.edu/tests"},"existing JSON-driven interactive page "),"without any loss of functionality. To support an ",r.a.createElement("a",{href:"https://participant.com/campaigns/slaythedragon"},"marketing partnership"),", I used Netlify Functions to deploy an RSS feed. I sunset the Firebase- and Django-driven pages, replacing them with static Markdown and an Airtable integration respectively."),r.a.createElement("p",null,"The Airtable integration lets the team easily create one-pager content and launch new interactive maps. One recent map shows how various states' redistricting processes would be affected by delays in the 2020 Census. It's been shared across ",r.a.createElement("a",{href:"https://twitter.com/search?q=https%3A%2F%2Fgerrymander.princeton.edu%2Fredistricting-timeline-alert-map&src=typed_query"},"election twitter "),"and ",r.a.createElement("a",{href:"https://www.dailykos.com/stories/2021/3/26/2023090/-Voting-Rights-Roundup-GOP-passes-Georgia-s-most-far-reaching-voting-restriction-law-since-Jim-Crow"},"political news"),". The team will use the site for further interactive research reports and data visualization as redistricting commences."),r.a.createElement("a",{href:"https://gerrymander.princeton.edu/redistricting-timeline-alert-map"},r.a.createElement("img",{src:"/static/96a8b5993177d730ced8b143744d9087/redistricting-timeline-map.png"})))),r.a.createElement("hr",null),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"openprecincts",style:{marginBottom:Object(o.a)(1/4)}},"OpenPrecincts")),r.a.createElement("section",null,r.a.createElement("h4",null,r.a.createElement("a",{href:"https://openprecincts.org"},"visit the site")),r.a.createElement("h5",null,"2020 — now"),r.a.createElement("h5",null,"Python, Django, Mapbox"),r.a.createElement("p",null,"OpenPrecincts is a project hosting precinct-level electoral geospatial data. I took over engineering in spring 2020. I realized the data-production team was creating multiple shapefiles per state, but was only able to display one. So, I added the ability to read info about, download, and view multiple precinct-level electoral result maps. This was a full stack project, across the project's React/Django code."),r.a.createElement("p",null,"In the process, I had our team join the Mapbox Community program, and",r.a.createElement("a",{href:"https://www.mapbox.com/webinars/election-maps-princetongerry"}," gave a talk on it as part of the Mapbox Elections Challenge speaker series"),"."),r.a.createElement("a",{href:"https://openprecincts.org/tx"},r.a.createElement("img",{src:"/static/62ffafc499d7f2da798060f697a2e59f/openprecincts.png"})))),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"sharedstreets",style:{marginBottom:Object(o.a)(1/4)}},"SharedStreets Road Closure Tool")),r.a.createElement("section",null,r.a.createElement("h4",null,r.a.createElement("a",{href:"http://roadclosures-test.sharedstreets.io/"},"visit the site")," |",r.a.createElement("a",{href:"https://github.com/sharedstreets/sharedstreets-road-closure-ui"},"github")),r.a.createElement("h5",null,"2018-2019"),r.a.createElement("h5",null,"React, Redux, Mapbox"),r.a.createElement("p",null,"I joined ",r.a.createElement("a",{href:""},"SharedStreets")," as the first employee. A few projects were spun up simultaneously to try to find a use for the SharedStreets linear referencing system."),r.a.createElement("p",null,"I designed and built a web app myself with React/Redux using Mapbox to manage road closures. I worked with PANYNJ's data partnerships team to test an integration within their Agency Operations Center. The app used the SharedStreets referencing system to make the data easily translatable between various government and commerical base maps, to try and prevent vendor lock-in. I wrote features based on PANYNJ feedback, such as scheduled closures, and code to munge data into the Waze CIFS format."),r.a.createElement("p",null,"I ",r.a.createElement("a",{href:"https://www.youtube.com/watch?v=ROemNM73E2c"}," gave a talk on it at State of the Map US 2019 "),"and at ",r.a.createElement("a",{href:"https://www.youtube.com/watch?v=LUbZs_Kv-Pg"},"a Transit Techies meetup"),"."),r.a.createElement("a",{href:"http://roadclosures-test.sharedstreets.io/"},r.a.createElement("img",{src:"/static/d9d84dc8b7de82f9e592031a2bd38df2/sharedstreets.png"})))),r.a.createElement("hr",null),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"pavement-mgmt",style:{marginBottom:Object(o.a)(1/4)}},"Pavement (curb management tool)")),r.a.createElement("section",null,r.a.createElement("h4",null,r.a.createElement("a",{href:"https://drive.google.com/file/d/1NfhtqkfGBOVULoaAPGoYT7ZFjhY0DLWI/view"},"video demo")," |",r.a.createElement("a",{href:"https://drive.google.com/file/d/1m3_IEqpjnn2kx-yPdHXO43zOBdwegGUc/view"},"one pager")," |",r.a.createElement("a",{href:"https://github.com/teampavement/pavement-dashboard"},"github")),r.a.createElement("h5",null,"2018"),r.a.createElement("h5",null,"React, Redux, Leaflet, PostGIS"),r.a.createElement("p",null,"Continuing the parking theme, built I built a parking/curb management web app with two teammates. I wrote all of the frontend code (react, redux) and did some geospatial data munging (",r.a.createElement("a",{href:"https://gist.github.com/indraneel/be554a9485e4837a5e40050a61a73199"},"I kept the postgis query"),"). Worked with one teammate on the necessary backend work, scoping out API requirements. With another teammate, I called cities until we found a partner in, and ran a pilot program w/, the City of Asbury Park. Ultimately we didn't find a strong product-market fit and disbanded the project. I joined SharedStreets shortly thereafter."),r.a.createElement("img",{src:"/static/32f0533a6f74fa537c1ef36650a9b933/pavement-mgmt.png"}))),r.a.createElement("hr",null),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"pavement-viewer",style:{marginBottom:Object(o.a)(1/4)}},"Pavement (curb rules viewer)")),r.a.createElement("section",null,r.a.createElement("h4",null,r.a.createElement("a",{href:"https://trypavement.com/"},"visit the site")," |",r.a.createElement("a",{href:"https://github.com/teampavement/pavement-sms"},"github")),r.a.createElement("h5",null,"2018"),r.a.createElement("h5",null,"React, Leaflet"),r.a.createElement("p",null,"Downtown Jersey City was in the middle of rapid growth in 2017. A friend and I built a web map of all the parking rules in Downtown Jersey City to solve our own parking problems. I wrote all of the frontend code (react + a leaflet map) to visualize the data manually gathered by my teammate."),r.a.createElement("p",null,"Spoke with members of the City's Innovation team, who were supportive of the project verbally (though not financially). Still, seemed like there was something there around digitizing the curb."),r.a.createElement("p",null,"To support data collection, ",r.a.createElement("a",{href:"https://github.com/indraneel/parking-sign-builder"},"I wrote a smaller tool to help generate properly formatted JSON"),"."),r.a.createElement("a",{href:"https://trypavement.com/"},r.a.createElement("img",{src:"/static/f6d27e19b54a50248f172178cf41362e/pavement-viewer.png"})))),r.a.createElement("hr",null),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"sust-dashboard",style:{marginBottom:Object(o.a)(1/4)}},"Sustainable Jersey hackathon")),r.a.createElement("section",null,r.a.createElement("h4",null,r.a.createElement("a",{href:"https://blog.grdodge.org/2017/04/19/sustainable-jersey-15-sustainable-solutions-to-community-challenges/"},"read the story")," |",r.a.createElement("a",{href:"https://www.slideshare.net/rickytrent/coding-for-community-team-dashability"},"see the slides |"),r.a.createElement("a",{href:"https://github.com/indraneel/sustainability-dashboard"},"github")),r.a.createElement("h5",null,"2017"),r.a.createElement("h5",null,"React, Redux"),r.a.createElement("p",null,"Won 2nd place in a civic hackathon held by ",r.a.createElement("a",{href:"https://www.sustainablejersey.com/"},"Sustainable Jersey")," in 2017. We spoke with a NJ town who wanted a solution to track their sustainability goals. We met with their green team leader a few times, and determined that visualizing their progress was important for volunteers to feel bought into the work. We also determined that the ability to share on social media. Over the period of a week, I wrote a web dashboard app in React, featuring a Pinterest-style card layout for easy sharing. Good first foray into civic tech."),r.a.createElement("img",{src:"/static/11bfcac58409ca12f0c2f03cc5cf8184/sust-dashboard.png"}))),r.a.createElement("hr",null),r.a.createElement("article",null,r.a.createElement("header",null,r.a.createElement("h2",{id:"appnexus",style:{marginBottom:Object(o.a)(1/4)}},"AppNexus (assorted projects)")),r.a.createElement("section",null,r.a.createElement("h5",null,"2015-2018"),r.a.createElement("h5",null,"React, Redux"),r.a.createElement("p",null,"Worked on a few enterprise web apps to start my career. Learned JavaScript, React, and agile software development. They are probably defunct now but you can read some archived product blog posts:",r.a.createElement("ul",null,r.a.createElement("li",null,r.a.createElement("a",{href:"https://web.archive.org/web/20180514073045/http://productblog.appnexus.com/rapid-reliable-creative-previewing-2/"},"Rapid, Reliable Creative Previewing")),r.a.createElement("li",null,r.a.createElement("a",{href:"https://web.archive.org/web/20190127133700/https://productblog.appnexus.com/"},"Native advertising tools for Buyers and Sellers")))),r.a.createElement("img",{src:"/static/1298424fbcb01359304be7b42f5b8242/appnexus.png"}))))}}}]);
//# sourceMappingURL=component---src-pages-work-js-e9d5ff34a202ca1b423a.js.map