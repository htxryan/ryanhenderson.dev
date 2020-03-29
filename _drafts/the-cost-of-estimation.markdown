---
layout: post
title:  "Estimates vs. #NoEstimates: A False Dichotomy"
date:   2020-03-28 00:00:00 -0500
tags: [estimation, project management]
permalink: /estimates-vs-no-estimates-a-false-dichotomy
---
![Photo by [Icons8 Team](https://unsplash.com/@icons8?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText) on [Unsplash](https://unsplash.com/?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText)](/assets/images/the-cost-of-estimation.jpg)

**Yes, another "software estimates good/bad" rant &mdash; but hear me out.**

It's not "estimates vs. [no estimates](https://ronjeffries.com/xprog/articles/the-noestimates-movement/)". This is a false dichotomy, and it leads to red herring arguments on both sides. "Estimates are a waste of time" and "estimates are a necessary, critical part of the business process" are both *valid* and *invalid* arguments, depending on the context. Allow me to explain.

## The Problem with Not Estimating

Let's agree that we live in the real world. Here in the real world, estimates are inaccurate, yet business leaders require them. Why? Because without any information on estimated cost, leaders cannot prioritize amongst competing interests. Each possible project has a perceived value, and in order to evaluate whether or not to deliver that value, leaders must have some understanding of the cost.

The only way to get an understanding of the cost before actually delivering the work is to *estimate*. There is no getting around it &mdash; for those outside of software companies (and many inside software companies), estimates must be provided prior to a project being started/funded.

So doesn't this invalidate the [#NoEstimates](https://ronjeffries.com/xprog/articles/the-noestimates-movement/) philosophy? If we must provide estimates, how can we get value from a #NoEstimates way of thinking? The answer is simple, yet often overlooked.

## The Problem with Estimating

[…]

- Estimates are misused by executives to "hold people accountable"
- ...

## The Solution

No, I don't have a magic trick to estimating accurately while not wasting any time. The solution is far more mundane: approach estimation like you approach technical solutioning.

A widely known and (largely) accepted concept in software development is the [Minimum Viable Product](https://en.wikipedia.org/wiki/Minimum_viable_product) (MVP). An MVP represents the quickest/smallest/easiest-to-produce version of a product that will be "viable" in the market (e.g. customers will use it, and ideally pay for it). The purpose of building an MVP is clear: build *something* so we can quickly get feedback from customers and keep moving forward.

Thus, my proposal to solving the estimates vs. no estimates dilemma is the **Minimum Viable Estimate (MVE)**. An MVE is the quickest/smallest/easiset-to-produce estimate for a given project that satisfies the *confidence level* required by the audience of the estimate. Stated differently: **an MVE is the estimate which maximizes the confidence level (CL) and minimizes time-to-estimate (TTE) to the point that satisfies the audience of the estimate and the project schedule.**

### Confidence Level (CL) and Time-to-Estimate (TTE)

**Confidence level (CL)** literally refers to the level of confidence you have in a given estimate. If you report a confidence level of 90%, that means you are very sure that you can accomplish the task within the estimate provided &mdash; in this case the estimate would be closer to an informed evaluation than a guess. If you report a confidence level of 10%, you are barely certain at all &mdash; in this case the estimate would be closer to a guess than an informed evaluation.

**Time-to-Estimate (TTE)** refers to the time it takes you to provide an estimate (*not* the estimate itself). If I asked you to estimate how long it would take you to drive from your home to your workplace, you could probably come up with it pretty quickly since it's something you do most days. If I asked you how long it would take for a space shuttle to reach Jupiter, you would probably need a longer TTE to come up with a reasonable estimate.

These two concepts work in concert with each other, and are positively correlated. By increasing TTE, you can increase CL. If you cut TTE short, you are likely to also see a drop in CL.

The concept of a **confidence level (CL)** and **time-to-estimate (TTE)** are critical to grasp, so let me illustrate with an example. [Note: this example is a little contrived, but hopefully it illustrates the point.]



<u>**Project**</u>: "Drive from Houston, Texas to Pittsburgh, Pennsylvania."

For a first pass, let's use a TTE of 30 seconds. This is sometimes called a "back of the napkin" estimate.

**TTE: 5 seconds**

- CL=90% | **Estimate**: 2 weeks
- CL=50% | **Estimate**: 2 days

I am 90% confident that I would be able to make the drive given two full weeks. I don't really know how far apart these cities are, or what roads I would take, or if there are any external factors (such as having to drive an electric vehicle, or an approaching hurricane) that would affect my trip. All that said, I think two weeks would give me enough slack to make it to Pittsburgh even if I hit some pretty significant delays. If I drop the CL down to 50%, I'll say 2 days. There's probably a good chance I can optimize my route and minimize stops to be able to make it there in this time, but it's still a coin flip &mdash; 50%/50% chance. **Overall, this means that this project is likely to take between 2 days and 2 weeks to complete.**



For a second pass, I'll take a bit more time: 30 seconds. I can use this time to think about similar drives I've done in the past.

**TTE: 30 seconds**

- CL=90% | **Estimate**: 3 days
- CL=50% | **Estimate**: 36 hours

Ok, with 25 extra seconds I had time to think back to other drives I've made. Once in college, I drove from Austin, Texas to Witchita, Kansas for a conference, and I think that took about 10 hours. If I extrapolate a bit, I would guess that Houston/Pittsburgh are about 3 times the distance apart than Houston/Omaha, so that would put us at roughly 30 hours. What I don't know is if there are mostly straight-shot interstate from Texas to Pennsylvania like there was from Austin to Omaha, or if I'll have to do some doubling back. I feel good enough now to say that I'm 90% confident that I can make it in 3 days (e.g. I still haven't looked at the weather, so if a hurricane is coming that could cost me some time). My low CL estimate is still set at 36 hours (1.5 days) though, as even after thinking about it for a longer, I don't really think I could make it any quicker.



For our last pass, I'll take a couple minutes to look up how long Google Maps says the trip will take, and then weigh that against my own experience.

**<u>TTE: 2 minutes</u>**

- CL=90% | **Estimate**: 30 hours
- CL=50% | **Estimate**: 24 hours

Well look at that &mdash; I was wrong on two fronts. The drive from Austin to Witchita is only only 8 hours long, and Google Maps says the drive from Houston to Pittsburgh will take 20 hours. So if I factor in a few hours for gas/food/bathroom stops, I would say I'm 90% confident I can make it in 30 hours, and 50% confident I could make it in as little as 24 hours.



In the example above, you can see how spending more time on the estimate (increasing TTE) allowed us to narrow our confidence band (the difference between 50% and 90%-confidence estimates). You might be able to think of scenarios where the 5 second estimate was good enough, and other scenarios where we need the more narrow confidence band made possible by a 2-minute TTE.

## Produce Your Minimum Viable Estimate (MVE) by Adjusting Time-to-Estimate (TTE) to Reach Your Desired Confidence Level (CL)

Ok, that was a lot. Here's the point: you should avoid arguing over whether to provide estimates or not, and instead shift the conversation to agree upon an appropriate TTE to reach the desired CL of your stateholder(s), in order to produce your MVE.

<iframe title="Estimate vs. TTE" aria-label="Interactive line chart" id="datawrapper-chart-V27qE" src="//datawrapper.dwcdn.net/V27qE/1/" scrolling="no" frameborder="0" style="width: 0; min-width: 100% !important; border: none;" height="339"></iframe><script type="text/javascript">!function(){"use strict";window.addEventListener("message",function(a){if(void 0!==a.data["datawrapper-height"])for(var e in a.data["datawrapper-height"]){var t=document.getElementById("datawrapper-chart-"+e)||document.querySelector("iframe[src*='"+e+"']");t&&(t.style.height=a.data["datawrapper-height"][e]+"px")}})}();
This chart uses the values from the driving example above to illustrate the **confidence band** of our estimate. You can see that by moving down the x-axis (TTE), we can narrow the gap between our 50% and 90% estimates.

## Practical Steps Forward

If you find yourself trapped in the estimate dilemma, try these tactics:

**Communicate your confidence level alongside your estimate**

By providing your confidence level alongside any estimate you provide, you can start to shift the conversation to the TTE/CL realm, where it is easier to negotiate rationally about how much time should be spent on a given estimate. How valuable is it to narrow the confidence band? Is a back-of-the-napkin estimate good enough? Or should we spend 2 hours in a room hashing it out?

**Provide estimates for multiple confidence levels**

By providing multiple estimates &mdash; one for each confidence level, as in the illustration above &mdash; you can accomplish two things at once: 1) you can communicate the level of uncertainty in the given task (high uncertainty indicated by a wide CL band, low uncertainty indicated by a narrow CL band), and 2) you can hopefully avoid having the takeaway from an estimation conversation be a single number.

**Agree on a target confidence band before spending too much time on an estimate**

On software projects, estimates are often given at different granularities at different points in the project. Before development on a project/feature begins, estimates are sometimes given in the form of **developer-iterations** or **team-iterations**. During a project, individual stories and tasks are often estimated using **story points** or even **developer-hours**. We can see the confidence band at work here: at the start of the project, the largest interval by which the estimate can be adjusted is a full iteration (2-3 weeks, typically), while an estimate for a task in the middle of a project can be adjusted by just an hour.

It is critical to always be deliberate about the confidence band you are targeting. If a new feature is proposed in the middle of a project, it may not be necessary to estimate it at the finest granularity &mdash; maybe a ballpark-level figure in team-iterations is good enough.



[give multiple estimates at two or more confidence levels when providing estimates]

[spend more time to increase confidence levels]

[agree on required confidence level before spending extra time making an estimate more accurate]





**[value-based estimation]**