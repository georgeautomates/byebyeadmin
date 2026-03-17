// Blog post data — static content, no CMS.
// Add new posts by appending to the POSTS array.

export type Block =
  | { type: 'p'; text: string }
  | { type: 'h2'; text: string }
  | { type: 'h3'; text: string }
  | { type: 'quote'; text: string; attribution?: string }
  | { type: 'callout'; text: string; accent?: boolean }
  | { type: 'list'; items: string[] }
  | { type: 'number-list'; items: string[] }
  | { type: 'divider' }
  | { type: 'cta'; label: string; href: string; subtext?: string }

export type Post = {
  slug: string
  title: string
  excerpt: string
  date: string
  readTime: string
  category: string
  tags: string[]
  content: Block[]
}

export const POSTS: Post[] = [
  {
    slug: 'cost-of-manual-order-entry',
    title: 'The Real Cost of Manual Order Entry in UK Haulage',
    excerpt:
      "Every order typed by hand is a few minutes of someone's time, multiplied across every job, every day. Here is what that actually adds up to, and what you can do about it.",
    date: '2026-03-10',
    readTime: '7 min read',
    category: 'Operations',
    tags: ['order entry', 'admin', 'efficiency', 'fleet operations'],
    content: [
      {
        type: 'p',
        text: "There's a moment I keep coming back to. I was sitting in the office of a 28-vehicle operator in Kent, watching him take a phone order. He had a pen in one hand, a Post-it note in the other, and three different windows open on his screen: his TMS, a spreadsheet, and an email thread from the customer with the delivery spec.",
      },
      {
        type: 'p',
        text: 'He typed the job into all three. Then he printed the job sheet. Then he filed the email. The whole thing took about four minutes. Then his phone rang again.',
      },
      {
        type: 'h2',
        text: 'Four minutes does not sound like much',
      },
      {
        type: 'p',
        text: "Until you do the maths. His operation runs roughly 60 jobs a day. Even if half of those come in digitally — portal bookings, EDI, structured emails — that still leaves 30 jobs a day getting typed in by hand.",
      },
      {
        type: 'callout',
        accent: true,
        text: '30 jobs x 4 minutes = 2 hours of manual entry. Every single day. On a 5-day week, that is 10 hours a week. 520 hours a year. Thirteen 40-hour working weeks spent on order entry alone.',
      },
      {
        type: 'p',
        text: "That is not including the time spent chasing missing information, correcting typos that made it into the TMS, or re-entering jobs that got emailed in a slightly different format than expected.",
      },
      {
        type: 'h2',
        text: 'The error cost is worse than the time cost',
      },
      {
        type: 'p',
        text: "Manual entry errors in haulage do not just waste time. They create a chain of downstream problems that are genuinely expensive.",
      },
      {
        type: 'list',
        items: [
          "Wrong delivery address entered: driver goes to the wrong site, customer gets charged for a failed delivery, you don't",
          'Incorrect weight or dimensions: either the job gets repriced (awkward conversation) or it does not (margin hit)',
          'Job entered under the wrong customer account: invoicing chaos, credit control chasing the wrong entity',
          'Missed special instructions: tail-lift required, appointment booking needed, hazardous goods documentation. Things that only matter when they go wrong',
        ],
      },
      {
        type: 'p',
        text: "A 2023 industry estimate put the cost of a single haulage error, factoring in driver time, re-delivery, and admin to resolve it, at between £80 and £250 depending on severity. You do not need many of those a month before it becomes a significant number.",
      },
      {
        type: 'h2',
        text: 'Why this is hard to fix manually',
      },
      {
        type: 'p',
        text: "The frustrating thing about order entry is that it does not feel like a solvable problem, because the information arrives in so many different ways.",
      },
      {
        type: 'p',
        text: "You have got customers who email in a structured format, customers who call, customers who use their own booking portals, customers who WhatsApp a photo of a handwritten note. Some send Excel attachments. Some send PDF job sheets. Some send a four-line email with half the information missing and assume you will figure out the rest.",
      },
      {
        type: 'p',
        text: "A human can handle all of those. A human can read an ambiguous email, know from context which customer it is from, understand that '3 pallets, Kent, Tuesday' means the standing Maidstone delivery, and enter it correctly. A traditional automation rule cannot.",
      },
      {
        type: 'quote',
        text: "That is exactly the problem AI is built to solve. Not rigid rule-matching. Contextual understanding.",
      },
      {
        type: 'h2',
        text: 'What changes when you automate order entry',
      },
      {
        type: 'p',
        text: "When we set up automated order entry for a client, the process looks like this: emails land in the inbox, the system reads them, extracts the job details, cross-references against the customer's history and standing instructions, and drafts the entry into the TMS, flagging anything it is not confident about for human review.",
      },
      {
        type: 'p',
        text: "In the first few weeks, it flags a lot. That is intentional. The system is learning the quirks of each customer: which one always uses 'ref' for their purchase order number, which one always books for the next working day even when they say 'ASAP', which one's address field needs the postcode adding because they never include it.",
      },
      {
        type: 'p',
        text: "By week six or seven, the flagging rate drops significantly. The jobs that do get flagged are genuinely ambiguous: missing information, unusual instructions, first-time customers. Everything else goes through cleanly.",
      },
      {
        type: 'callout',
        text: "One operator we work with went from 2.5 hours of daily order entry to about 20 minutes of exception review. The exceptions are the jobs that actually need a human. Not the routine ones.",
      },
      {
        type: 'h2',
        text: 'The honest limits',
      },
      {
        type: 'p',
        text: "Automated order entry is not magic. There are scenarios it handles less well.",
      },
      {
        type: 'list',
        items: [
          'Customers who phone every order in: voice transcription and call integration are possible but add complexity',
          'Very high-variability jobs where almost every order has unique requirements',
          'Operations where the TMS API is limited or nonexistent, though most modern systems have one',
          'Teams where the review process is not well-defined: if nobody is checking the flagged exceptions, you have just moved the problem',
        ],
      },
      {
        type: 'p',
        text: "It also takes time to learn. The first month is investment. You are training the system on your specific operation, your specific customers, your specific quirks. There is no shortcut to that.",
      },
      {
        type: 'h2',
        text: 'Is it worth it for your size of operation?',
      },
      {
        type: 'p',
        text: "The honest answer is: it depends on your job mix. If most of your work comes through a single portal and arrives in a clean, consistent format, you have already solved most of the problem. The pain is proportional to the variety and volume of manual intake.",
      },
      {
        type: 'p',
        text: "A rough rule: if you are spending more than an hour a day on order entry, and more than 30% of your jobs arrive in unstructured formats, the maths usually work. If you are at 40 or more vehicles and taking phone orders regularly, it almost certainly works.",
      },
      {
        type: 'cta',
        label: 'Take the Free Assessment',
        href: '/assessment',
        subtext:
          'Find out what order entry automation could save your specific operation. Takes 5 minutes.',
      },
      {
        type: 'h2',
        text: 'The real cost',
      },
      {
        type: 'p',
        text: "Back to the operator in Kent. I asked him, half-joking, what he would do with an extra two hours a day. He did not miss a beat: 'I would actually look at the P&L properly. I would spend time with drivers instead of just shouting at them. I would go home before 7.'",
      },
      {
        type: 'p',
        text: "That is what manual order entry actually costs. Not just the hours. The headspace. The ability to run the business instead of being run by it.",
      },
      {
        type: 'p',
        text: "The admin is not the job. But for a lot of operators, it is eating the job.",
      },
    ],
  },

  {
    slug: 'ai-for-fleet-reality-check',
    title: "What AI Can (and Can't) Do for Your Fleet Right Now",
    excerpt:
      "The AI hype is real and so are the limits. Here is an honest breakdown of what is actually working for UK operators right now, and where it still falls short.",
    date: '2026-02-24',
    readTime: '5 min read',
    category: 'AI Tools',
    tags: ['AI', 'automation', 'fleet management', 'technology'],
    content: [
      {
        type: 'p',
        text: "Everyone in haulage has heard the pitch by now. AI will handle your bookings, write your invoices, manage your compliance, plan your routes, and probably make you a cup of tea while it is at it. Some of that is true. Some of it is vendor nonsense. Here is how to tell the difference.",
      },
      {
        type: 'h2',
        text: "What is actually working today",
      },
      {
        type: 'callout',
        accent: true,
        text: "The areas where AI genuinely delivers results for UK haulage operators right now: order intake and data extraction from unstructured sources, invoice matching and discrepancy flagging, compliance document monitoring, and customer communication drafting.",
      },
      {
        type: 'list',
        items: [
          'Order intake from emails, PDFs, and portals: reading varied formats and extracting structured job data reliably',
          'Invoice matching: cross-referencing PODs, purchase orders, and invoices to flag discrepancies before they become disputes',
          'Compliance monitoring: tracking driver licence renewals, vehicle inspection due dates, operator licence conditions',
          'Customer update drafts: generating delivery notifications and ETAs from live job data',
        ],
      },
      {
        type: 'h2',
        text: "Where it still falls short",
      },
      {
        type: 'p',
        text: "Route optimisation, dynamic load planning, and real-time traffic response all get a lot of attention, but for most small and mid-size operations, the gains are marginal compared to the integration cost. The admin bottleneck is almost always bigger and cheaper to fix than the operational one.",
      },
      {
        type: 'p',
        text: "Start with the hours your office is losing to manual processes. That is where the return is. The fancy stuff can come later.",
      },
    ],
  },

  {
    slug: 'digital-compliance-uk-haulage',
    title: 'Digital Compliance in UK Haulage: What the New Requirements Actually Mean',
    excerpt:
      "DCSA digital standards, operator licence conditions, driver hours records: what the shift to digital compliance means in practice for small and mid-size fleets.",
    date: '2026-02-10',
    readTime: '6 min read',
    category: 'Compliance',
    tags: ['compliance', 'DCSA', 'operator licence', 'digital records'],
    content: [
      {
        type: 'p',
        text: "Compliance in haulage has always been paper-heavy. Tachograph records, driver licence checks, vehicle inspection sheets, operator licence conditions: a significant chunk of every admin function is just maintaining the paperwork trail that proves you are running a legal operation.",
      },
      {
        type: 'h2',
        text: "What is actually changing",
      },
      {
        type: 'p',
        text: "The shift is not a sudden overnight change. It is a gradual tightening of expectations around digital record-keeping: DVSA enforcement teams increasingly expect operators to produce digital records on request, the DCSA frameworks are being referenced more in freight contracts, and larger hauliers are starting to require digital compliance evidence from subcontractors.",
      },
      {
        type: 'list',
        items: [
          'Digital tachograph analysis and driver hours reporting becoming standard for multi-vehicle operations',
          'Operator licence condition monitoring: knowing when conditions change, not finding out at an audit',
          'Vehicle maintenance records: digital scheduling and completion tracking replacing paper job cards',
          'Subcontractor compliance checks: customers and lead contractors asking for evidence, not just assurances',
        ],
      },
      {
        type: 'p',
        text: "The practical implication: if you are still running compliance on spreadsheets and filing cabinets, you are not breaking the law today. But you are making it harder to grow, harder to win certain contracts, and harder to demonstrate due diligence if something goes wrong.",
      },
      {
        type: 'p',
        text: "The good news is that automating compliance monitoring is one of the most straightforward applications of AI in haulage. The data already exists. It just needs to be read, tracked, and surfaced before deadlines become problems.",
      },
    ],
  },
]

export function getPost(slug: string): Post | undefined {
  return POSTS.find((p) => p.slug === slug)
}

export function getRelatedPosts(slug: string): Post[] {
  return POSTS.filter((p) => p.slug !== slug).slice(0, 2)
}

export const CATEGORIES = ['All', ...Array.from(new Set(POSTS.map((p) => p.category)))]
