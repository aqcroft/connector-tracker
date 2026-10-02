# Connector Tracker - Replit UX Brief

## Purpose

I want you to review and improve an existing working app called **Connector Tracker**.

Before changing code, please inspect the current project and understand the product intent below.

I do **not** want a rebuild from scratch unless absolutely necessary. The existing data model, business logic and local-first architecture contain a lot of useful work already.

Your main job is to make the everyday experience dramatically simpler, clearer and more natural on mobile.

---

## Background

I am a Utility Warehouse Partner.

Utility Warehouse has a **Connector** model where organisations such as sports clubs, charities, community groups or businesses can introduce people who may be interested in Utility Warehouse services.

The organisation can benefit financially from successful referrals.

The first real-world pilot for this app is **Leicester Dynamite**, a junior basketball club.

The app must eventually support multiple different Connector organisations, not just Leicester Dynamite.

Examples might include:

- sports clubs
- charities
- community organisations
- businesses
- fundraising partners

Each Connector may have:

- its own name
- logo
- main contact
- its own activity
- multiple UW Partners helping with it
- separate results and reporting

---

## Why this tool exists

The official Utility Warehouse systems already handle formal customer applications and official Connector lead submission.

This app is **not** intended to replace that system.

It exists because I need a very simple operational layer around the Connector relationship.

I want to be able to answer questions such as:

- How much activity have we done for this Connector?
- How many genuine Leads has that created?
- How many appointments were set?
- How many appointments were actually sat?
- How many customers resulted?
- How many new UW Partners resulted?
- What services were taken?
- How much income has the Connector generated?
- Which events, campaigns or channels are working?
- Which UW Partner generated each Lead?
- Are there Leads that need updating?
- Are there deliberate future follow-ups?

The tool should also make it easy to give the Connector contact a simple aggregate update showing what the relationship is generating.

---

## Primary use case

The **primary use case is on-the-day activity**.

Imagine two or three UW Partners standing at a basketball event.

During the day they may:

1. Speak to people.
2. Complete a "20K" entry/form with somebody.
3. Turn some of those conversations into genuine Leads.
4. Send somebody a quote.
5. Arrange an appointment.
6. Occasionally sign somebody up there and then.
7. Come back later and update what happened.

The app should make this incredibly quick.

A Partner standing at an event should be able to open their phone and immediately understand:

> "Where do I tap?"

They should be able to do something like:

- +20K
- +Lead

with almost no friction.

They should **not** feel as though they have opened Salesforce.

---

## Important terminology

### 20K

A 20K entry is top-of-funnel activity.

It is simply a count of forms/entries completed by a Partner during an event.

For example:

- Adrian: 6
- Salima: 7
- Destiny: 5
- Team total: 18

A 20K entry is **not automatically a Lead**.

### Lead

A Lead in this app means a genuine Connector Lead that has actually been submitted into the official UW Connector process.

Therefore:

18 20K entries  
might create  
9 genuine Leads

Do not make users manually record "Lead sent" separately if creating the Lead already represents that event.

### Appointments

Use the language:

- Appointment set
- Appointment sat

These are historical milestones.

For example:

Lead  
→ Appointment set  
→ Appointment sat  
→ Customer

But a Lead could also become:

Lead  
→ Appointment set  
→ Ghosted

Appointment set must still count historically.

### Customer and Partner outcomes

Customer and Partner are parallel outcomes.

A person may:

- become a customer
- become a UW Partner
- become both
- become neither yet

Do not force these into one exclusive status field.

---

## Who uses the app

There are potentially several UW Partners working on the same Connector.

Initially:

- Adrian
- Salima
- Destiny

Each Partner should easily see their own activity and Leads.

An Admin should also be able to see overall team activity.

The Partner who originally generated a Lead should retain historical credit.

The system may also have a Current Owner for operational continuity, but that should not dominate the UI.

The app should feel collaborative rather than managerial.

---

## Multiple Connectors

This should support multiple Connector organisations.

A Partner might have access to:

- Leicester Dynamite
- another charity
- another sports club
- a local business Connector

Different Partners may have access to different Connectors.

Do not assume every Partner can see every Connector.

However, this should remain visually simple.

The fact that the data model can support multiple Connectors should not make the everyday mobile UI feel complicated.

---

## Activities

Activity is the umbrella concept.

There are three useful types:

### 1. Event

Examples:

- Saturday Training
- Match Day
- Charity Event

### 2. Campaign

Examples:

- Parent WhatsApp Push
- Facebook Campaign
- Instagram Campaign

### 3. Ongoing activity / asset

Examples:

- website
- permanent QR poster
- A-frame signage

Do not add more Activity types unless there is a very strong reason.

A Lead may be linked to an Activity, but Activity attribution is optional.

A Lead might simply come from:

- WhatsApp
- Facebook
- Website
- Unknown

Never force attribution where it is not known.

---

## Channels

Useful broad channels include:

- In-person
- WhatsApp
- Facebook
- Instagram
- Website
- Email
- Physical signage
- QR
- Other
- Unknown

Again, do not make this burdensome.

---

## Data minimisation

This is deliberately **not a contact-management CRM**.

A Lead generally only needs:

- first name / short name
- date
- source/channel
- optional Activity
- generated by Partner
- progression/outcome
- optional follow-up date
- customer services/result where relevant

Do not introduce:

- full contact records
- addresses
- phone numbers
- email addresses
- detailed notes
- task management systems
- pipelines with dozens of stages
- appointment times
- sales forecasting

unless absolutely necessary.

I specifically want to avoid this becoming a mini CRM.

---

## Core daily jobs

The app should make these jobs obvious:

### 1. Event Day

Run today's Event.

Record:

- my 20K count
- new Leads
- immediate progression

### 2. Leads

Add and manage Leads.

Update what happened.

### 3. Action Inbox

Show only Leads where something is genuinely incomplete.

Examples:

- new Lead with no meaningful next step
- appointment date has passed but no outcome recorded
- appointment sat but result has not been recorded

This is different from Follow-ups.

### 4. Follow-ups

A deliberate future action.

Examples:

- No for now - try again in 3 months
- quote sent - review next week
- ghosted - retry later

A Lead can be fully up to date and still have a future Follow-up.

### 5. Results

Understand what activity is generating.

### 6. Activities

Create, edit and review Events, Campaigns and ongoing Activities.

### 7. Setup / Admin

This should exist but should not dominate everyday use.

---

## What the Connector cares about

The Connector contact does **not** need access to individual Lead information.

They care about aggregate outcomes such as:

- 20K activity
- Leads generated
- appointments set
- appointments sat
- customers
- services
- new UW Partners
- Connector income
- which activity is generating results

Eventually there should be a polished aggregate report that can be shared with the Connector contact.

Do not show:

- Lead names
- private Partner earnings
- follow-up details
- internal notes

---

## What I care about internally

Internally I also want to understand:

- Partner activity
- Partner conversion
- what events work
- what channels work
- where Leads are getting stuck
- Connector income
- Partner earnings

This reporting is useful, but it must **not** make the everyday app feel like analytics software.

The reporting complexity should sit behind Results, not on the Home screen.

---

## Product philosophy

Think:

> **"Very clever digital clipboard"**

Not:

> **"CRM"**

The app should feel:

- lightweight
- obvious
- quick
- friendly
- visual
- mobile-first
- forgiving
- easy to learn without training

A Partner should be able to use it while standing in a sports hall talking to somebody.

The app should hide complexity until complexity is actually needed.

---

## Current UX problem

The existing product has useful architecture and functionality, but the UI still feels too much like a database/dashboard.

Specific issues I have experienced:

- navigation repeats itself
- some destinations feel like they take me back to the same place
- it is not always obvious where I am
- it is not always obvious how I got there
- it is not always obvious how to get back
- browser Back/swipe behaviour has been inconsistent
- some screens contain too much information
- some controls are visually cramped on mobile
- Action Inbox can look messy
- reports drill-downs can feel disconnected from the screen they came from
- the tool exposes more structure than I need during normal use

I want to feel that I could genuinely use this every day.

---

## Navigation thinking

Please challenge the current navigation.

I am open to a simpler structure.

One possible direction is to keep a small set of major coloured mode buttons visible and consistent:

- 🏀 Event Day - orange
- 👥 Leads - blue
- 📥 Action Inbox - pink
- 📊 Results - green
- 📚 Activities - purple

If a colour represents a mode, carry that colour through the mode so the user always has visual context.

Do not use huge saturated backgrounds everywhere.

Use restrained visual accents such as:

- header/accent
- buttons
- selected states
- cards
- navigation indicator

The user should subconsciously know:

> "I'm in Leads - blue."

The mobile experience matters much more than desktop.

Desktop can retain a sidebar if useful.

---

## Success test

Imagine I arrive at Leicester Dynamite on Saturday morning.

I open the app.

Within a couple of seconds I should know exactly how to:

- open today's Event
- add one to my 20K count
- add Sarah as a Lead
- mark that Sarah has an appointment set
- later mark Sarah as sat
- record that Sarah became a customer
- see whether anything else needs updating

I should not need to understand the underlying database structure.

The app should reduce mental load rather than create it.

---

## Do not change the backend architecture yet

The current project is a local-first PWA.

It uses:

- IndexedDB
- local persistence
- an outbox concept for future sync
- GitHub Pages/static hosting

A future phase will connect this to:

- Google Sheets
- Google Apps Script API
- secure Partner/device authentication
- shared cloud data
- public aggregate Connector reports

Do **not** replace this architecture with:

- Replit Database
- Supabase
- Firebase
- another backend

for this UX exercise.

This is specifically a front-end/product-design exercise.

---

## Preserve important existing logic

Please preserve:

- multiple Connectors
- Partner access per Connector
- Generated By attribution
- Current Owner concept
- 20K Partner counts
- Leads
- Appointment set / sat milestones
- Customer and Partner outcomes
- Follow-ups
- Action Inbox
- Activity attribution
- service basket/results
- commission rule architecture
- aggregate reporting
- local-first persistence
- versioning/changelog system

Do not simplify by deleting useful underlying capability.

**Simplify what the USER sees.**

---

## Versioning

The project has a permanent versioning rule.

Every code/UI/behaviour change must:

- increment the app version appropriately
- update `app-meta.js`
- update What's New / changelog
- update About
- update relevant cache/service-worker versioning

Please preserve this process.

---

## How I want you to approach this

Do **not** start coding immediately.

### Step 1

Inspect the existing application and current UX.

### Step 2

Give me a short UX critique based on the real use case above.

Identify:

- what should remain
- what is creating unnecessary cognitive load
- what should move
- what should disappear from everyday view
- what navigation structure you recommend

### Step 3

Propose the simplest mobile interaction model you think genuinely fits the use case.

Do not merely restyle the existing screens.

Think about the jobs the Partner is trying to accomplish.

### Step 4

Only after defining that model, implement the UX changes.

Do not add functionality merely because you can.

The goal is not to impress me with features.

The goal is for me to open the finished app and think:

> **"Yes. I can actually use this."**
