It's always some ungodly hour.

The phone buzzes on the nightstand. You already know before you look. Pager alert. A booking service is throwing 500s, climbing, customers can't check in.

You open the laptop in the dark, the screen too bright for your eyes. Slack is already filling up. *Is this just me?* someone writes. Then five more people say the same thing in five different ways. The dashboards are a wall of green except for one red line, climbing, and nobody in the thread knows why yet.

That's the moment I built Zero for. Not the outage itself (outages happen, they always will) but that specific, miserable stretch between *something broke* and *here's why*. The stretch where six people are tabbing between CloudWatch and the ECS console and a Slack thread and last quarter's postmortem doc, trying to hold the whole system in their head at once, at 3 A.M., half-asleep, guessing.

<nav class="toc">
<span class="toc-label">In this post</span>
<ol>
<li><a href="#how-big-this-problem-actually-is">How big this problem actually is</a></li>
<li><a href="#where-teams-break-down-today">Where teams break down today</a></li>
<li><a href="#enter-zero">Enter Zero</a></li>
<li><a href="#the-house-zero-investigates-nexacore-prime">The house Zero investigates: Nexacore Prime</a></li>
<li><a href="#the-agent-itself-three-layers-of-harness">The agent itself: three layers of harness</a></li>
<li><a href="#how-an-alert-actually-becomes-an-investigation">How an alert actually becomes an investigation</a></li>
<li><a href="#how-the-coordinator-delegates-and-keeps-itself-honest">How the coordinator delegates, and keeps itself honest</a></li>
<li><a href="#watching-zero-actually-work-a-case">Watching Zero actually work a case</a></li>
<li><a href="#what-this-actually-buys-a-team">What this actually buys a team</a></li>
<li><a href="#what-id-actually-do">What I'd actually do</a></li>
</ol>
</nav>

## How big this problem actually is

Here's the thing people outside engineering never quite grasp: downtime isn't an inconvenience. It's a bill, and it arrives by the minute.

<div class="stat-row">
  <div class="stat-card">
    <span class="stat-value">~$2M</span>
    <span class="stat-label">median cost per hour of a high-impact outage</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">~$33K</span>
    <span class="stat-label">every minute it stays down</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">~$76M</span>
    <span class="stat-label">median yearly cost of high-impact outages</span>
  </div>
</div>

New Relic's 2025 Observability Forecast, a survey of more than 1,700 IT and engineering professionals across 23 countries, puts the median cost of a high-impact outage at roughly $2 million an hour. That's about $33,333 for every minute the system stays down. Across a year, the median cost of high-impact outages for a business lands around $76 million. That's one survey's median, for outages severe enough to count as high-impact in the first place.

Other numbers tell a similar story from different angles. ITIC's 2024 research found that over 90% of mid-size and large enterprises lose more than $300,000 an hour when a critical system goes down, and 41% of them lose somewhere between $1 million and $5 million or more in that same hour. EMA's research, cited through BigPanda, puts the average unplanned outage at roughly $14,056 a minute, nearly 10% higher than it was just two years earlier. Even Gartner's often-quoted 2014 figure of $5,600 a minute, extrapolated out, works out to $336,000 an hour, and that number is over a decade old now, which tells you which direction it's been moving.

Small businesses aren't spared either. Research cited by Gatling in 2026 puts the average cost for a company with fewer than 25 employees at about $1,670 a minute, nearly $100,000 an hour. Scale changes the number. It never erases it.

So the problem is big, measurably big, and the clock doesn't pause while your team figures out what's actually wrong.

## Where teams break down today

Most organizations throw people at the problem. Site reliability engineers, on-call rotations, incident commanders, a war room on a video call. It's a real discipline, and good SRE teams are genuinely good at it. But the tools they're handed haven't kept pace with the systems they're asked to protect.

Picture the actual mechanics of an incident. An alert fires in one tool. The relevant logs live in a second tool. The deployment history that might explain it sits in a third. The runbook that covers this exact failure mode (if it exists, if anyone remembers it exists) is buried in a wiki page nobody's opened since it was written. The engineer on call has to open all of these, hold the shape of the problem in their head, and manually stitch together a story that makes sense. That stitching is the actual work. Everything else is plumbing.

Vendor estimates on how long that stitching takes vary, and they should be read with a grain of salt since most come from companies selling a fix for it. But the range they describe (twenty minutes on the fast end, sixty to ninety minutes for a serious incident, sometimes longer when the failure crosses team boundaries) tracks with what anyone who's sat in a war room already knows in their gut. Lowe's, in a public case study with Google Cloud, described cutting its own mean time to resolution from two hours down to seventeen minutes. A result worth celebrating, and also a quiet admission of how long two hours used to be the normal answer.

<div class="callout">
<p><span class="callout-label">Takeaway</span>the expensive part of an incident isn't the outage, it's the manual stitching-together of six tools' worth of evidence into one coherent story, and that stitching is exactly the kind of toil you can hand to a system that doesn't get tired at 3 A.M.</p>
</div>

## Enter Zero

Zero is an AI operations assistant, built to sit inside the mess I just described and actually do the stitching. It does not replace the SRE. It replaces the part of the job that's pure toil: opening six tabs, copying log lines into a doc, trying to remember where the deploy history lives.

Under the hood it's a Node and TypeScript system: a Hono backend, a SvelteKit web workspace, PostgreSQL with pgvector for durable memory and retrieval. But the stack matters less than what it lets happen: Zero connects, through governed connections, to the cloud providers, Kubernetes clusters, ITSM systems, databases, and monitoring tools a team already runs. It doesn't ask anyone to rip out Datadog or PagerDuty or ServiceNow. It asks to be let into the room where those tools already live, with the same tenant and resource permissions the backing user already holds, nothing more.

I'm going to walk through exactly how it works using a real architecture, not a toy diagram: the system I used to build and test it against. That matters, because a lot of what makes Zero actually useful only shows up once you see it reasoning about real service names, real target groups, real queues. So before I show you the agent, let me show you the house it investigates.

## The house Zero investigates: Nexacore Prime

Cloud providers love inventing fancy names for very simple physical ideas. Strip away the acronyms (VPC, ALB, ECS, SQS, ElastiCache) and all we really have here is a fenced-off building, a front-desk receptionist, a workshop full of specialized workers, a wall of sticky notes, a conveyor belt for packages, and an automated fire alarm system. And it isn't just a map of servers, it's a detective's map, built specifically to teach an automated troubleshooting agent, Zero, how to investigate emergencies when things break.

<figure class="diagram-figure">
  <a class="diagram-frame" href="images/zero-nexacore-architecture.svg" title="Open the full-size diagram">
    <img src="images/zero-nexacore-architecture.svg" alt="Nexacore Prime AWS architecture in us-west-2: internal clients reach an internal ALB inside a VPC; the ALB writes access logs to S3 and routes through 15 target groups to 15 ECS services in the nx-prime-nexacore cluster, with 5 'No ECS' target groups marked separately. ECS services use three Valkey ElastiCache clusters and two SQS FIFO queues with dead letter queues. A panel on the right maps CloudWatch alarm categories to Zero's investigation skills, with an HTTP 5xx quick reference." loading="lazy">
  </a>
  <figcaption>
    Nexacore Prime, the environment every case in this post runs against. Read it left to right: clients → ALB → target groups → ECS, with caches and queues below and the alarms that wake Zero up on the right.
    <span class="diagram-actions"><a href="images/zero-nexacore-architecture.svg">Open full size</a> · <a href="images/zero-nexacore-architecture.excalidraw" download>Download the .excalidraw file</a></span>
  </figcaption>
</figure>

### 1. The fenced compound & the visitors (VPC & clients)

Before you build a factory, you put a fence around your land so strangers from the street cannot wander into your workshop.

**VPC** (`vpc-1842d4ff5dd49fa2d` | Region: `us-west-2` | Scheme: Internal): VPC stands for Virtual Private Cloud, which is simply your private, isolated slice of Amazon's computer network in Oregon (`us-west-2`). Notice it says Scheme: Internal. That means this entire compound has no public front door directly on the open internet.

**Internal Clients & Upstream**: here's your first big clue as an architect: the box on the far left actually says Internal Clients & Upstream. Because this VPC is internal, a random smartphone on the street cannot talk to this system directly; instead, traffic arrives from an "upstream" gatekeeper (like a separate public API gateway, a VPN, or another internal company server) that has already vetted the visitor and is now passing the request inside the fence.

### 2. The receptionist & the ledger book (ALB & S3)

Once a request steps inside the fence, it doesn't know which worker in the back room handles smart locks, power grids, or tenant bookings. It needs a single front desk.

**Internal ALB** (`nx-prime-pvt-alb`): ALB stands for Application Load Balancer. Think of it as a super-fast receptionist sitting at the front desk with a phone address (DNS: `internal-nx-prime-pvt-alb-9841205312...`). "Load balancing" just means if 1,000 requests show up at once, the receptionist spreads the work evenly across workers in the back room so no single worker collapses from exhaustion.

**Listeners** (HTTP: 80, 8080, 8090 and HTTPS: 443): A "Listener" is just the receptionist keeping an ear open on specific phone extensions (ports). Port 443 (HTTPS) is for encrypted, secret conversations, while ports 80, 8080, and 8090 (HTTP) are standard unencrypted internal extensions used inside the private network.

**S3 Access Logs Bucket** (`prime-alb-logs-bucket`): S3 (Simple Storage Service) is Amazon's bottomless digital filing cabinet. Every time a request passes through the ALB receptionist, the ALB writes a one-line receipt (who called, when, what URL they asked for, and whether it succeeded) and drops it into a folder called `access-logs/` inside this bucket. When an alarm goes off later, the `alb-investigation` skill reads these receipts to see exactly what happened.

### 3. The department directory & pulse checkers (target groups)

How does the receptionist (ALB) know which back-room worker can handle a specific request, and whether that worker is even awake? That is the job of a Target Group. When a request comes into the ALB (say, asking for `/api/power`), the ALB checks its rulebook and forwards the call to the matching Target Group, which holds a list of the actual containers running that code.

**15 Active Target Groups**: 15 active departments, each mapped to one of the 15 active services in the cluster.

**Health Checks** (The Nurse Checking Pulses): A Target Group doesn't blindly send work to a server that might have crashed. Every few seconds, the Target Group acts like a nurse poking each worker on a specific URL path (like `/health`, `/api/health`, `/status`, or `/api/app/ping`) expecting a cheerful 200 OK response. If a container stops answering its health check, the Target Group declares it "unhealthy" and stops sending customer traffic to it until a fresh container replaces it.

**5 "No ECS" Target Groups**: `nx-prime-assistant-api-alb-tg`, `nx-prime-legacy-sso-pvt-alb-tg`, etc. In real-world engineering, systems evolve: old features get retired (Decommissioned) or moved outside the cluster (External), but someone forgets to delete the old phone directory entries on the load balancer. The diagram marks these so you don't waste time investigating ghost services that don't run in ECS anymore.

### 4. The workshop floor (ECS cluster: nx-prime-nexacore)

Now we enter the big orange box: ECS, which stands for Elastic Container Service.

Imagine trying to run 15 different programs written in Python (`flask-app`), Node.js (`-node`), and Java (identity-style services) all on one giant computer. They would fight over memory and software versions. Instead, engineers package each small program into a Container, a lightweight, self-contained mini-computer box that has only the exact code and libraries that specific job needs. ECS is the automated factory manager that boots up those containers, restarts them if they crash, and scales them up or down.

Your cluster (`nx-prime-nexacore`) splits the whole company's brain into 15 specialized microservices:

- **Smart Device & IoT Controllers**: Services like `nx-prime-asset-registry-node`, `nx-prime-access-control-node` (smart locks/doors), `nx-prime-power-grid-node` (thermostats/power), `nx-prime-remote-ctrl-node`, `nx-prime-cloud-bridge-node`, and `nx-prime-clientapp-server` handle the day-to-day commands talking to physical hardware.
- **Over-The-Air Updates** (`nx-prime-firmware-server-flask-app`): A Python Flask app dedicated to pushing software/firmware updates out to physical devices ("Over-The-Air").
- **Business, Scheduling & Alerts**: `nx-prime-tenant-service` talks to the tenant/booking system, `nx-prime-workflow-node` handles operational workflows, `nx-prime-alerter-service` sends out alerts/emails/texts, and `nx-prime-scheduler` acts as an alarm clock that triggers scheduled background jobs.
- **Security & External Hooks**: `nx-prime-identity` is an open-source identity guard that handles logins and security tokens (notice its health check uses encrypted `HTTPS:443 /`), while `nx-prime-event-webhook` manages webhooks (automated event notifications sent between apps).
- **Internal & Monitoring Tools**: `nx-prime-admin-console` and `nx-prime-core-telemetry-python` handle internal staff dashboards and system monitoring.

**Why are 3 services inside the ECS box outlined in bright red?** Because real human engineers built this system, and humans aren't always consistent! The diagram is warning you about two naming traps.

The **Target Group Name Mismatch** ([TG != ECS]): Almost every service has a Target Group with the exact same name, except `nx-prime-core-telemetry-python`, whose Target Group dropped the word "core" (`nx-prime-telemetry-python-tg`).

The **Custom Log Folder Trap** ([Custom Log Prefix]): Twelve of the services write their logs to `/ecs/nx-prime-<service-name>`, except `nx-prime-admin-console` and `nx-prime-event-webhook`, which tuck their logs inside an extra subfolder: `/ecs/prime-nexacore/nx-prime-...`. If you don't know that, you'll look in the standard folder during an outage and think the logs vanished!

I'm not going to pretend this is a hypothetical gotcha. It's exactly the kind of thing that makes the difference between an agent that looks competent in a demo and one that actually works against production. Zero gets this knowledge the same way a new on-call engineer would (baked into a loaded skill file) rather than guessing it from the name.

### 5. The wall of sticky notes (ElastiCache / Valkey)

Down at the bottom left is ElastiCache. Why do your ECS workers have a dashed arrow pointing down here?

Suppose every time a smart lock checks in, an ECS container has to look up whether a guest is still checked in by querying a traditional hard-drive database (like RDS). Going to a traditional database is like walking across town to the city library: it takes tens of milliseconds, and if 10,000 devices ask at once, the library doors jam shut.

**In-Memory Caching** (Valkey 8.0.1): ElastiCache puts a super-fast scratchpad directly in RAM (computer memory). Instead of walking to the library, the worker glances at a sticky note on their desk in less than a millisecond. It runs Valkey 8.0.1 (the modern, open-source successor to Redis) on `cache.t4g.small` servers.

**Replication Groups** (001 and 002): Notice that `nx-prime-cache` has two nodes: `nx-prime-cache-001` and `nx-prime-cache-002`. RAM is fast, but if the power flickers on machine 001, everything in RAM disappears. So node 001 (the Primary) constantly copies every sticky note onto node 002 (the Replica). If 001 dies, 002 immediately steps up to save the day.

**Shared Neighbors** (Prime, Prod, QA): Inside this same VPC, you can see three separate ElastiCache clusters sitting side-by-side for three environments: `nx-prime-cache`, `nx-prod-cache`, and `nx-qa-cache`.

### 6. The conveyor belt & the penalty box (SQS FIFO & DLQ)

Look at the bottom right green box: SQS FIFO Queues & Dead Letter Queues. When an ECS service has a job to do, there are two ways to do it.

- **Synchronous** (Phone Call): Service A calls Service B and waits on hold until Service B finishes. If Service B is slow or crashes, Service A gets stuck too.
- **Asynchronous** (Conveyor Belt / SQS): Service A drops a task card onto a moving conveyor belt (SQS, Simple Queue Service) and immediately goes back to work. Workers at the other end pick up cards off the belt at their own pace.

**Why `.fifo` (First-In, First-Out)?** Standard queues try to be fast, which means sometimes message #2 sneaks ahead of message #1. Usually that's fine, but look at what these two queues handle: `Prime-OrderSync.fifo` (room bookings) and `Prime-NodePulse.fifo` (device status heartbeats). If a guest books a room and modifies the booking two seconds later, processing those out of order would corrupt the reservation! A FIFO queue guarantees strict single-file order: first in, first out.

**Why the Red Dead Letter Queues (DLQ)?** Imagine a poisoned message lands on the `Prime-OrderSync.fifo` conveyor belt, maybe a reservation with a malformed date that causes the worker container to crash every time it tries to read it. Because it's a FIFO queue, that one bad message would block the entire line behind it forever! To prevent a permanent traffic jam, after a worker fails to process a message a few times, SQS automatically yanks the bad message off the main belt and tosses it into a side bin called a Dead Letter Queue (`Prime-OrderSync-DLQ.fifo` / `Prime-NodePulse-DLQ.fifo`).

**96h DLQ Retention**: Those broken messages sit safely in the red DLQ bin for 96 hours (4 days) so engineers can inspect them, fix the code bug, and replay them before Amazon automatically deletes them.

### 7. The flight recorders & the automated doctor (CloudWatch & Zero)

Finally, look at the purple box (CloudWatch Logs) inside ECS and the tall red column on the far right (CloudWatch Alarms → Zero Skills). When 15 different services, 3 cache clusters, and 4 queues are humming along in the dark, how do you know when something breaks? Amazon CloudWatch acts as both the security camera and the smoke detector.

**CloudWatch Logs** (`/ecs/nx-prime-`): Every time a container runs a line of code or hits an error, it prints text to the screen. CloudWatch collects all that text into centralized log folders so you (or the `cloudwatch-logs-investigation` skill) can search through them like a black-box flight recorder.

**CloudWatch Alarms → Zero Skills**: CloudWatch constantly watches numerical gauges (metrics), like CPU percentage, memory usage, HTTP error counts, or messages landing in a Dead Letter Queue. When a gauge crosses a danger line, a CloudWatch Alarm fires and wakes up Zero, an automated troubleshooting agent equipped with specific "skills" (playbooks) for each type of emergency:

<div class="table-scroll table-prose">

| Alarm category | What triggered it | First skill → follow-up |
|---|---|---|
| ALB 5xx / 502 (e.g. "ALB High 5xx Errors – Target Level," 3,186 past triggers; "502-error-count-for prime-alb," 157) | The front desk is handing out 500/502/503/504s | `alb-investigation` → `tg-health-investigation` → `ecs-service-investigation` |
| ECS CPU & memory (e.g. "Prime-server ECS CPU Monitor," 443 triggers; "Workflow-MemoryUtilization-Exceed," 10) | A container's CPU or RAM is maxed out | `ecs-metrics-investigation` → `cloudwatch-logs-investigation` (error/OOM preset) |
| ElastiCache (Memory Alert, 14 triggers; CPU Alert, 1) | Valkey's RAM or CPU running hot | `elasticache-investigation` → `rds-investigation` (DB fallback check) |
| SQS DLQ ("Prime-OrderSync-DLQ-Alarm," 11 triggers) | Failed messages piling up | `sqs-dlq-investigation` → `ecs-metrics` + `cloudwatch-logs` |

</div>

Those trigger counts are specific for a reason: they're the actual alarm history baked into the skill catalog, not made up for the post. 3,186 past triggers on target-level 5xx errors tells you this alarm fires constantly and needs a fast, well-worn investigation path; 1 past trigger on ElastiCache CPU tells you that's a rare event worth taking seriously when it does happen.

And here's the piece of mental scaffolding that everything downstream depends on, the **HTTP 5xx cheat sheet**:

| Code | Meaning | What actually happened |
|---|---|---|
| 500 | Internal Server Error | The container got the request, ran the code, the code threw an unhandled exception |
| 502 | Bad Gateway | The container died or dropped the connection mid-request |
| 503 | Service Unavailable | Every container behind the target group is dead, overloaded, or OOM; there's nothing to route to |
| 504 | Gateway Timeout | The container is alive but stuck waiting on something downstream (a DB lock, a slow dependency) until the ALB's own timer gives up |

<div class="callout">
<p><span class="callout-label">Takeaway</span>a 5xx code isn't a generic "it's broken" signal; each number names a different layer of the stack, and the fastest path to root cause is knowing which layer to check first instead of opening six dashboards and hoping.</p>
</div>

## The agent itself: three layers of harness

Here's where I need to be honest about something, because it's the single most important design decision in Zero and it's easy to understate: **none of the three layers I'm about to describe trust the LLM to behave.** Every one of them is deterministic code that enforces a rule regardless of what the model decides to do. That's the difference between a demo and something you can actually page people with at 3 A.M.

Think of the LLM agent as a race car engine. The harness is everything around the engine that makes it safe on a real track: the seatbelt, the fuel gauge, the speed limiter, the pit-stop radio. The agent itself is just the think → act → observe loop. The harness is what makes that loop production-ready.

### Layer 1: the runtime adapter

This is the outermost shell, and it works like a universal remote: swap the TV brand (OpenAI SDK → LangGraph Deep Agents) and everything else still works the same way. In sequence, it:

1. finds the right agent-construction function (trying multiple import paths, because defensive coding beats a single brittle import),
2. builds the underlying chat model,
3. wraps every tool into a framework-compatible function while preserving its name, docstring, and schema,
4. resolves the system prompt (static text or a function that builds it fresh),
5. creates the agent graph and sets a hard recursion limit,
6. streams the framework's internal events and translates them into Zero's own event format,
7. and handles retries, rate limits, and cancellation.

The payoff: when the underlying framework changed, the web UI, Slack integration, and database didn't need a single line touched. The harness absorbed the difference.

### Layer 2: the orchestrator

This is the brain's control room, and before the model ever sees a message, it does five things:

1. assembles an 18-section system prompt fresh every turn (persona, available tools, the skills catalog, infrastructure context, injected memory, safety rules),
2. pulls relevant past incidents automatically via an intent classifier,
3. sets a time and tool-call budget based on how serious the alert looks,
4. compacts old messages into a structured checkpoint once the context gets too long,
5. and, if the clock runs out mid-investigation, reserves the last 60 seconds to synthesize a partial answer from whatever was actually gathered, instead of just cutting off.

It's the hospital triage nurse: before the doctor sees the patient, the nurse pulls the file, checks vitals, sets a timer, preps the room.

### Layer 3: the tool hooks

This is the guardrail wrapped around every single tool call the agent makes, and it's worth naming each check because each one closes a real failure mode:

- **Budget check:** "have you used too many tool calls this turn?" → refuse.
- **Dedupe check:** "you just ran this exact command with these exact arguments" → return the cached result instead of re-running it.
- **Repeat-limit check:** "you've called this identical thing five times" → stop, because that's a model stuck in a loop.
- **Deadline check:** "your wall-clock time is up" → refuse new calls.
- **Containment:** sub-agents cannot spawn more sub-agents, cannot write to memory.

It's a credit card's fraud detection system: the card still works, but something is watching every swipe that can say no based on rules the cardholder doesn't control.

### How the three layers stack

Stacked together, an incoming message flows: orchestrator builds the prompt and sets budgets → runtime adapter creates the graph and streams events → tool hooks check budget, dedupe, and deadline on every single tool call before the actual tool executes → compaction and timeout synthesis kick in if needed → response goes back to Slack or the web UI.

<div class="pipeline">
  <div class="pipeline-flow">
    <span class="pipeline-flow-label">One incoming message</span>
    <div class="pipeline-step">
      <span class="pipeline-step-label">Orchestrator</span>
      <span class="pipeline-step-sub">builds the prompt, sets budgets</span>
    </div>
    <div class="pipeline-arrow"></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">Runtime adapter</span>
      <span class="pipeline-step-sub">creates the graph, streams events</span>
    </div>
    <div class="pipeline-arrow"><span>on every tool call</span></div>
    <div class="pipeline-step pipeline-step-accent">
      <span class="pipeline-step-label">Tool hooks</span>
      <span class="pipeline-step-sub">budget · dedupe · repeat limit · deadline</span>
    </div>
    <div class="pipeline-arrow"><span>only if every check passes</span></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">Tool executes</span>
    </div>
    <div class="pipeline-arrow"><span>if needed</span></div>
    <div class="pipeline-step pipeline-step-muted">
      <span class="pipeline-step-label">Compaction / timeout synthesis</span>
    </div>
  </div>
  <div class="pipeline-connector"><span>response</span></div>
  <div class="pipeline-step pipeline-step-final">
    <span class="pipeline-step-label">Slack or web UI</span>
  </div>
</div>

<div class="callout">
<p><span class="callout-label">Takeaway</span>the thing that makes an LLM agent trustworthy in production isn't a smarter model; it's wrapping a merely-competent model in three layers of deterministic code that refuse to let it blow its budget, loop forever, or keep running past its deadline, no matter what it "wants" to do.</p>
</div>

## How an alert actually becomes an investigation

I want to trace this precisely, because the gap between "an alarm fired" and "the LLM is looking at it" is where most of the real engineering lives, and it's almost entirely boring, deterministic Python, which is exactly the point.

Think of it like a hospital emergency system: an ambulance (the alert) arrives, a receptionist fills out a standard intake form, a triage nurse opens a case file and assigns a doctor, and only then does the doctor start working.

<div class="pipeline">
  <div class="pipeline-flow">
    <span class="pipeline-flow-label">From alarm to investigation</span>
    <div class="pipeline-step pipeline-step-muted">
      <span class="pipeline-step-label">1 · Alert source</span>
      <span class="pipeline-step-sub">CloudWatch, Datadog, PagerDuty, Jira, email</span>
    </div>
    <div class="pipeline-arrow"><span>raw vendor payload</span></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">2 · Source module</span>
      <span class="pipeline-step-sub">normalizes it into one Alert shape</span>
    </div>
    <div class="pipeline-arrow"><span>alert.received</span></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">3 · In-process event bus</span>
      <span class="pipeline-step-sub">pub/sub, no network hop</span>
    </div>
    <div class="pipeline-arrow"></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">4 · Alert handler</span>
      <span class="pipeline-step-sub">severity, threading, prompt, attachments</span>
    </div>
    <div class="pipeline-arrow"></div>
    <div class="pipeline-step pipeline-step-accent">
      <span class="pipeline-step-label">5 · Orchestrator</span>
      <span class="pipeline-step-sub">intent, memory search, 18-section prompt, budget</span>
    </div>
  </div>
  <div class="pipeline-connector"><span>first token of LLM reasoning</span></div>
  <div class="pipeline-step pipeline-step-final">
    <span class="pipeline-step-label">Agent graph starts</span>
    <span class="pipeline-step-sub">progress streams to Slack or the web UI</span>
  </div>
</div>

**Step 1: the alert is born**, outside Zero entirely. A CloudWatch alarm fires, Datadog detects a spike, PagerDuty pages someone, a Jira ticket gets created, an email lands. Each of these speaks a completely different format.

**Step 2: source modules translate it.** Each alert source (Datadog, PagerDuty, email, Jira) has its own module that takes the raw, vendor-specific payload and converts it into one standard shape: an `Alert` object, with the same fields every time (severity, source, message, timestamp, resource) regardless of where it came from. Datadog speaks French, PagerDuty speaks Spanish; the rest of the system only needs to understand English.

**Step 3: the event bus carries it.** The normalized `Alert` gets published as an `alert.received` event on an internal event bus. And I want to be precise about what this actually is, because it's a common point of confusion: **this is not SQS, SNS, or EventBridge.** It's not an external service at all. It's an in-memory publish/subscribe pattern running inside the same backend process. SQS is the postal service: messages travel across the network between separate machines. This event bus is a school intercom: someone speaks into the mic, and everyone in the building tuned to that channel hears it instantly. No network, no queue, no external dependency.

At startup, the alert handler subscribes itself to `alert.received`; later, when a webhook hits the endpoint, the source module normalizes the payload and publishes it, and the handler's callback fires automatically. The source module never calls the handler directly; it doesn't even know the handler exists. That decoupling is deliberate: you can add a new listener (metrics tracking, audit logging, a Slack notification) without ever touching the source module, the same reason a hotel has a reception desk instead of letting guests walk straight into the kitchen.

**Step 4: the handler triages.** This is where real preparation happens, and it does four things. It checks severity: a low-priority info alert might get dropped, a critical one goes straight through. It manages threading: it builds a `source_key` like `alert:datadog:12345` and reuses the existing conversation thread if that exact alert fires again, instead of opening a duplicate investigation, the same instinct as pulling an existing patient file instead of starting a new one. It builds the investigation prompt itself, something close to:

```
New critical alert from datadog:
5xx count > threshold on nx-prime-pvt-alb, 2026-03-18T10:02:00Z

Please investigate this alert and determine:
1. What is the root cause?
2. What is the impact?
3. What remediation steps are needed?
4. Should this be escalated?
```

And it ingests any attachments (graphs, screenshots) the alert arrived with.

**Step 5: the orchestrator preps the room**, and this is the part I find genuinely interesting, because it's the moment the system goes from "dumb pipeline" to "actually smart," and it happens entirely before the model sees anything.

First, an `IntentExtractor` reads the prompt ("5xx count > threshold on nx-prime-pvt-alb") and classifies it: intent `investigate`, systems `["aws", "alb", "ecs"]`, errors `["5xx"]`, `is_incident: true`, confidence `0.85`. This is deliberately not an LLM call. It's pattern matching and heuristics: fast, cheap, and good enough to decide whether it's worth the next, more expensive step.

If confidence clears the bar, the orchestrator runs a hybrid search against a local SQLite database, `memory.db`, which holds two search systems side by side:

- A **keyword search** using SQLite's FTS5 engine, a mini Google for the database, good at exact identifiers like ALB names and error codes.
- A **vector search**: every memory entry also carries a 384-dimension embedding from `all-MiniLM-L6-v2`, so a query for "5xx on load balancer" can match a record that says "ALB errors" even though the words don't overlap at all.

Think of two librarians working the same desk: one says "show me every book with the word 'elephant' in it," exact and literal; the other says "show me books about large African animals," working from meaning.

The two ranked lists get merged with **Reciprocal Rank Fusion**, and it's worth actually showing the math because it explains a real design choice: you can't compare a BM25 keyword score to a cosine similarity score directly, they're on different scales, like comparing kilometers to kilograms, so RRF merges by *rank position* instead:

```
RRF score(doc) = 0.3 / (60 + rank_keyword) + 0.7 / (60 + rank_vector)
```

The 0.7/0.3 split means meaning matters more than exact wording, but an exact identifier match still gets a real boost. The top five results (hard capped, with a 3-second timeout so memory lookup never slows down the response) get deduplicated and formatted by type into something like:

```
## Recent relevant incidents:
- Mar 10: 504s on nx-prime-pvt-alb. Root cause: RDS connection
  saturation after batch job. Resolution: killed batch, added
  connection pool limits.

## Known procedures:
- For ALB 5xx: use alb-investigation skill first, then follow
  the decision tree.

## Infrastructure notes:
- nx-prime-tenant-service-tg → nx-prime-tenant-service ECS service
  → log group /ecs/nx-prime-tenant-service
```

That block becomes one section of an **18-section system prompt** the orchestrator assembles fresh every single turn: persona and formatting rules, the tool reference, the actual tools available right now, the skills catalog, the injected memory above, infrastructure context, runtime info, and safety guardrails, among others. By the time the model sees the alert, it isn't guessing at any of this. It already has the alert, relevant history, infrastructure context, available skills, and a procedure to follow, all assembled by deterministic code before a single token of LLM reasoning happens.

Finally, the orchestrator sets a budget based on how serious this looks:

| Mode | Wall clock | Max tool calls |
|---|---|---|
| Fast | 60s | 8 |
| Balanced | 180s | 24 |
| Deep | 45 min | 48 |

A critical alert on a production ALB gets `deep`. A quick "what does this error mean" question gets `fast`. Only then does the orchestrator hand off to the runtime adapter, which creates the agent graph and starts streaming events back to Slack or the web UI as live progress: a model node runs, decides to call `list_skills()` and `memory_search()`, and the investigation visibly begins.

<div class="callout">
<p><span class="callout-label">Takeaway</span>by the time the LLM sees an alert, five layers of deterministic preprocessing have already happened (normalization, decoupled routing, triage, memory retrieval, and prompt assembly) and the quality of the eventual root cause has more to do with how good that preprocessing is than with how clever the model is.</p>
</div>

## How the coordinator delegates, and keeps itself honest

Once the model node is running, its first moves follow a fixed procedure baked into its loaded `WORKFLOW.md`:

- **Turn 1** is parallel discovery: it calls `list_skills()` and `memory_search()` in the same turn, because there's no reason to wait on one before starting the other.
- **Turn 2** loads whichever skill came back as the match; from this point "skills are law": the coordinator becomes a procedure executor following a fixed decision tree, not improvising.
- **Turn 3** is where it gets interesting, because the coordinator itself cannot run tools. No shell, no AWS calls, no log queries. It has to delegate, and delegation here is not a cheap function call; it's closer to onboarding a contractor for a single, narrowly scoped job.

A `SubagentRun` record gets created in a dedicated SQLite table with status `CREATED`, and the subagent gets its own dedicated transcript thread: its own project folder, everything it does recorded. It receives a clean context that does **not** include the coordinator's conversation: a specialist prompt for its role, a code-of-conduct document, a tool reference, diagnostic playbooks, and the specific task, with execution guardrails appended directly to the task text: keep scope strictly bounded, prefer concise evidence over broad exploratory retries, summarize partial findings and stop if blocked by repeated failures.

The child context it inherits also carries forward tool budgets, dedupe settings, and, critically, the parent thread's approval history, scoped secrets access limited to that specific agent's role, and a `parent_thread_id` so that if the user already approved "run read-only AWS commands" earlier in the conversation, the subagent doesn't have to interrupt anyone to ask again. It then launches as a background task: its own separate agent loop, running concurrently with the coordinator.

### How a subagent actually runs a command

A subagent calling, say, a skill's log-fetching script doesn't get a raw "run anything" command. It goes through two layers.

The first layer, `run_skill_script`, is a constrained executor: it resolves the script path only inside that skill's own `scripts/` folder (a path like `../../../etc/passwd` is rejected outright), it validates that the resolved path stays inside the skill directory. It detects the right interpreter from the file's shebang or extension. And it injects any secrets the script needs (AWS keys, for instance) as environment variables pulled from an encrypted, agent-scoped secrets store. The script sees them; the LLM never does.

The second layer is the shell tool itself, and every command passes through a full gauntlet before it executes. A `CommandAnalyzer` parses the command (including chained commands, where `a && b | c` gets classified by its single highest-risk component) into one of four tiers:

| Tier | Example |
|---|---|
| SAFE | read-only: `ls`, `cat`, a vetted script |
| MODERATE | writes files, makes network calls |
| HIGH | system changes, package installs |
| CRITICAL | `rm -rf`, shutdown, format |

Then an approval check runs, configured as `ask: off` (just run it), `ask: on-miss` (ask only if the command isn't already on an allowlist), or `ask: always`. If approval is needed, it goes out as a Slack button or web UI popup with a 120-second timeout, and every decision (approved, denied, timed out) gets logged to SQLite. But if the parent conversation already approved a similar class of command, the subagent inherits that approval and skips re-asking.

After that, if a Docker sandbox is enabled, the command runs inside an isolated container with its own resource limits; otherwise it runs on the host under a timeout. Only then do the same tool hooks from the harness (budget, dedupe, deadline, repeat limit) get checked one more time, and only then does the command actually execute. Output comes back formatted and size-capped, so a runaway log dump can't blow out the model's context window.

### Why database access and log access don't just go through the shell

For databases specifically, subagents don't get a raw SQL escape hatch. There's no path where a subagent runs `psql -h mydb.rds.amazonaws.com -c 'SELECT * FROM users'`: letting a model improvise raw SQL against production is exactly the kind of thing you don't want to allow. Instead it walks a structured, progressive discovery path: `postgres_connections()` to see what's available, then `postgres_schemas()`, `postgres_tables()`, `postgres_columns()`, and only then `postgres_query()`, the same discipline as navigating a folder tree instead of guessing a file path. Connection credentials never appear in the tool call; they're resolved from the secrets store at the moment of use, scoped to that agent. Query results are size-limited, and the tool itself handles connection pooling and timeouts; the model never manages a connection directly.

Logs follow the same philosophy from different directions depending on the source:

- **Skill scripts that pull from S3** are code-reviewed and run the same way every time, with credentials injected as env vars and output trimmed to a small markdown summary rather than raw text.
- **CloudWatch log queries** take a bounded time window and a filter pattern, so a subagent can't accidentally pull years of logs into context.
- **Servers outside AWS** go through a managed SSH layer: `search_logs()` and `tail_logs()` against a `server=` parameter, using managed keys rather than user passwords, with hardened SSH arguments that disable port forwarding and agent forwarding. Raw `ssh`, `scp`, and `sftp` commands typed into the shell tool are detected and blocked outright; it's the difference between a locksmith with a master key who logs every entry, and handing someone a copy of every key to every room.
- **Kubernetes**: the `cloud_diagnostics` agent works against an explicit safe-remediation allowlist. Rollout restarts, scaling replicas, deleting a stuck pod, and clearing a failed job are allowed; deleting a namespace, a PVC, or a service, or running `apply`/`create`, are not, baked into the tool policy itself, so it's not a matter of the model choosing not to.

### After the root cause is found

Two things happen once an investigation wraps, on two very different clocks.

**Immediately**, the coordinator, and only the coordinator, calls `save_memory()` to record the lesson. Subagents are explicitly denied write access to memory. The reasoning is straightforward: if every subagent could write independently, parallel investigations would produce contradictory entries, and low-quality fragments from agents that only ever saw a narrow slice of the problem. A single writer means the coordinator synthesizes everything first and saves one coherent lesson. That write lands in `memory.db` as text plus a freshly generated embedding, with the FTS5 index and category updated alongside it, and secrets never go in alongside it. The coordinator might record "RDS had high connections" but never a password or a key; those live entirely separately in the encrypted secrets store, and the model only ever sees metadata about them, never a value.

**Thirty minutes later**, with no human triggering it, a `ThreadIndexer` scores the now-idle conversation for investigation language ("root cause," "resolved"), known error patterns, diagnostic command usage, and resolution language. If the score clears a threshold, a separate utility LLM call extracts a structured record from it, with an explicit anti-hallucination instruction in the prompt:

> Only include explicitly mentioned information. Use null for fields without clear information.

That one sentence matters more than it sounds like it should: a system that quietly invents a root cause it never actually confirmed is worse than one that admits it doesn't know. The conversation is then chunked, embedded, and stored in a second index for future retrieval, and a skill-effectiveness tracker logs which skill chain actually resolved the incident, feeding back into what gets recommended first next time.

<div class="callout">
<p><span class="callout-label">Takeaway</span>every layer of this (path-validated scripts, secrets as environment variables the model never sees, a risk-tiered shell gauntlet, structured database tools instead of raw SQL, a managed SSH layer, a Kubernetes allowlist, and a single memory writer with an anti-hallucination instruction on the background extractor) exists because none of it trusts the model to be careful on its own. It's all deterministic policy sitting around a model that's merely good at reasoning, not infallible at it.</p>
</div>

## Watching Zero actually work a case

This is the part I actually enjoy explaining, because it's where all of the above either pays off or doesn't. I'm going to walk through real investigations against Nexacore Prime, in the order Zero would actually run them: what it checked, what it found, and what it concluded. If you want to follow along, keep the [architecture diagram](images/zero-nexacore-architecture.svg) open in another tab.

### Case 1: HTTP 500 on the tenant service: a bad deployment

An alarm fires: 5xx count over threshold on `nx-prime-pvt-alb`. The coordinator's parallel discovery turn calls `list_skills()` and `memory_search("nx-prime-pvt-alb 5xx")` at once: `list_skills()` comes back pointing at `alb-investigation`, `memory_search` turns up nothing relevant yet, since this is the first time this exact pattern has shown up. It loads `alb-investigation` and spawns `cloud_diagnostics` with a narrow task: fetch the ALB access logs for `nx-prime-pvt-alb` around 10:02 UTC.

The result comes back as a small markdown table, not raw log dumps: *"500 errors concentrated on `nx-prime-tenant-service-tg`."* The decision tree is unambiguous here: 500 on a specific target group means the application itself threw an exception. The coordinator loads `cloudwatch-logs-investigation`, spawns `log_analyst` with the `error` preset against `/ecs/nx-prime-tenant-service`, and gets back:

```
TypeError: cannot read property 'roomId' of undefined
at BookingHandler.process() line 142
Started after deployment v2.3.1 at 09:45 UTC
```

<div class="callout callout-verdict">
<p><span class="callout-label">Verdict</span>Root cause: a bug shipped in v2.3.1. Remediation: roll back, or hotfix line 142.</p>
</div>

The coordinator saves a memory: *"500s on tenant-service after v2.3.1 deploy, TypeError in BookingHandler.process()."*

### Case 2: HTTP 502 on the workflow service: OOMKilled

502 means the container died mid-request, like calling someone and they drop dead mid-sentence. `fetch_alb_logs.py` narrows it to `nx-prime-workflow-node-tg`, with `target_processing_time=-1`: the target never responded at all. The decision tree routes to `ecs-service-investigation`, which checks task events, deployment status, and restart count: tasks restarting every 3 minutes, exit code 137: OOMKilled. `ecs-metrics-investigation` confirms memory hit 100% right before each restart. `cloudwatch-logs-investigation` with the `oom` preset finds the correlation: the spike lines up with calls to `/api/export`, which loads an entire dataset into memory at once.

<div class="callout callout-verdict">
<p><span class="callout-label">Verdict</span>Root cause: an unbounded query on <code>/api/export</code> causing repeated OOMKills, surfacing at the ALB as 502s. Remediation: raise the memory limit as a stopgap, fix the endpoint to stream or paginate as the real fix.</p>
</div>

### Case 3: HTTP 503, two different stories depending on the target group

503 means zero healthy targets to route to, and it splits into two genuinely different incidents depending on scope.

**503 with no target group at all**: every target everywhere is failing. `tg-health-investigation` finds all targets in `nx-prime-identity-tg` unhealthy, the health check (`HTTPS:443 /`) returning 503. `ecs-service-investigation` on `nx-prime-identity` finds tasks running but the process not responding on port 443: the TLS certificate expired two hours earlier. That's a hard outage with an unglamorous cause, and I'll admit this is the kind of root cause that's almost embarrassing to report back to a team: the system didn't crash, nobody wrote a bug, a cert just lapsed.

**503 on one specific target group**: here's where the knowledge skill earns its place. The alert points at `nx-prime-telemetry-python-tg`, and remember: that target group dropped the word "core" and doesn't match the ECS service name `nx-prime-core-telemetry-python` at all. Without a loaded knowledge skill mapping that mismatch explicitly, an LLM would reasonably but wrongly guess at a service called something like `nx-prime-telemetry-python` and investigate the wrong thing, or find nothing. With the mapping loaded, `ecs-service-investigation` correctly targets `nx-prime-core-telemetry-python` and finds: desired count 2, running 0, pending 2, tasks stuck in `PROVISIONING`, no available capacity on the cluster. `ecs-cluster-overview` confirms cluster CPU reservation at 98%. Root cause: the cluster itself is out of room, so new tasks can't start, so the health check fails, so the ALB sees nothing to route to.

### Case 4: HTTP 504 on the tenant service: the hardest one, told in full

504 is the one I think is genuinely the most interesting failure mode in the whole system, because the cause is almost never in the service that's timing out; it's in something that service depends on. `fetch_alb_logs.py` narrows it to `nx-prime-tenant-service-tg`, `target_processing_time=-1`. The decision tree for 504 on a specific target group says: slow upstream dependency, run two investigations in parallel.

First, the coordinator loads the environment's knowledge skill, which maps `nx-prime-tenant-service-tg` → the `nx-prime-tenant-service` ECS service → log group `/ecs/nx-prime-tenant-service` → its actual dependencies: RDS, ElastiCache (`nx-prime-cache`), and SQS (`Prime-OrderSync.fifo`). Then it spawns two subagents at once:

- `log_analyst` runs `cloudwatch-logs-investigation` with the `timeout` preset against `/ecs/nx-prime-tenant-service` and finds a `SequelizeConnectionAcquireTimeoutError` repeated 340 times starting at 09:58 UTC.
- `cloud_diagnostics` runs `rds-investigation` and finds `DatabaseConnections: 410` against a threshold of 400, CPU at 92% against an 80% threshold, read latency at 180ms against a 50ms threshold, and no failover events, which rules out a more dramatic explanation.

Note something worth being honest about here: at this point the coordinator has strong evidence, not yet certainty. It runs two optional follow-ups the knowledge skill specifically suggests rather than assuming it's done. `sqs-dlq-investigation` on `Prime-OrderSync-DLQ.fifo` finds 37 messages piling up since 10:00: that's *impact* evidence, not cause, and the write-up needs to say so explicitly rather than conflating the two. `elasticache-investigation` on `nx-prime-cache` comes back clean (CPU 12%, memory 45%) which rules the cache out as a cause rather than confirming anything.

<div class="callout callout-verdict">
<p><span class="callout-label">Verdict</span>RDS connection saturation (410 connections against a 400 limit) means the tenant service can't acquire a database connection, requests hang, and the ALB eventually times out and returns 504. Impact: 37 failed bookings sitting in the dead letter queue. Explicitly ruled out: ElastiCache, no ECS crashes. Remediation: find whatever batch job or heavy query is consuming connections, and add a connection pool limit so this can't happen the same way twice.</p>
</div>

### Case 5: the cascading failure: when the symptom and the cause are in different layers

The hardest incidents are the ones where multiple alarms fire at once and look unrelated. Say ALB 504s show up on five different target groups simultaneously, ECS CPU alarms fire on several services, and an ElastiCache memory alert goes off at the same time. `alb-investigation` immediately rules out a single-service bug; one bad deploy doesn't produce 504s on five unrelated target groups at once. So the coordinator spawns parallel investigations against the system's *shared* dependencies rather than its individual services:

- `rds-investigation` finds connections at max, CPU at 99%, and a single long-running query holding a table lock for 45 minutes.
- `elasticache-investigation` comes back normal; Redis isn't the cause here either.
- `ecs-cluster-overview` shows every service technically healthy, just with response times ten times normal.

<div class="callout callout-verdict">
<p><span class="callout-label">Verdict</span>one long-running query (probably a report job or a migration someone kicked off) locked a table, every service querying that table started queuing behind it, connections piled up, the database saturated, and everything downstream that touched it timed out at once.</p>
</div>

This is the textbook "shared database as single point of failure" story, and the only way to see it is recognizing that 504s across *multiple unrelated target groups simultaneously* is itself the diagnostic signal; it rules out a single-service cause before you've even opened a log.

### Case 6: the ghost target group

And a smaller, stranger one, because it's a genuinely easy trap: 502s show up on `nx-prime-assistant-api-alb-tg`. `tg-health-investigation` finds zero healthy targets *and* zero registered targets: there's no ECS service behind this target group at all. The knowledge skill confirms it's one of the five "No ECS" target groups (decommissioned, external, whatever it used to be) but the ALB's listener rule is still routing traffic to it. Root cause isn't a service failure; it's a dead listener rule nobody cleaned up. Remediation is deleting the rule, not debugging a service that was never going to answer.

### The decision matrix, now that it's earned

<div class="table-scroll">

| Symptom | Code | First skill | What to look for | Likely root cause |
|---|---|---|---|---|
| ALB errors | 500 | alb → cloudwatch-logs (error) | Stack traces, exceptions | Code bug, bad deployment |
| ALB errors | 502 | alb → ecs-service | Exit code 137, restarts | OOMKill, container crash |
| ALB errors | 503 (no TG) | alb → tg-health | All TGs unhealthy | Cert expiry, cluster capacity |
| ALB errors | 503 (specific TG) | alb → ecs-service | Task count 0, provisioning stuck | Capacity, image pull failure |
| ALB errors | 504 | alb → logs + rds/elasticache | Timeout errors, DB metrics | Dependency saturation |
| ECS CPU high | N/A | ecs-metrics → logs | Infinite loops, hot endpoints | Bug, retry storm |
| ECS memory high | N/A | ecs-metrics → logs (oom) | Memory growth pattern | Leak, unbounded cache |
| ElastiCache memory | N/A | elasticache → rds (fallback) | Evictions, hit-rate drop | Key explosion, missing TTLs |
| DLQ messages | N/A | sqs-dlq → ecs + logs | Consumer errors, data issues | Bad data, consumer down |
| Multiple simultaneous | N/A | alb → shared dependencies | DB locks, network | Shared dependency failure |

</div>

<div class="callout">
<p><span class="callout-label">Takeaway</span>the HTTP status code is the first branch in the decision tree, not the final answer: 500 says look at the code, 502 says look at the container, 503 says look at capacity, 504 says look at what the service is waiting on, and the hardest incidents are the ones where the same symptom shows up on several unrelated services at once, which is itself the clue that the real cause is one layer further down than the alert makes it look.</p>
</div>

## What this actually buys a team

I don't think the honest pitch for Zero is "it's magic." It's compression. The work an SRE used to do by hand (open tool, read dashboard, open second tool, cross-reference, open wiki, search for the runbook, synthesize) gets done by something that can hold all of it in view at once, surface it inside the channel the team already lives in, and hand back a draft investigation instead of a blank Slack thread. Incidents that used to need everyone awake can start getting looked at the moment they're paged, correlated against the team's own history, before a single human opens their eyes.

It stays inside the lines that matter, too, and I'd be more worried about this system if it didn't. Tenant isolation holds. Role ceilings hold: a subagent genuinely cannot write memory or spawn further subagents, not because it's been asked nicely not to, but because the tool simply isn't given to it. Every risky action still passes through approval controls, and the investigation itself stays auditable: a replayable thread, not a vague summary someone has to take on faith.

I want to be clear about what this doesn't do, because I think a limitations section belongs in the body of a post like this, not as a disclaimer tacked on at the end. Zero is only as good as the knowledge skill mapping it's given: the target-group-name mismatch and custom-log-prefix cases in this post aren't edge cases I invented for color, they're exactly the kind of drift that happens in every real system over time, and if nobody keeps the knowledge skill current, the agent will confidently investigate the wrong thing. It also can't invent a runbook that was never written; it's compressing and correlating what the team already knows, not generating expertise from nothing.

None of this erases the dollar figures from earlier in this piece. Systems will still fail. Minutes will still cost money. But the gap between *something broke* and *here's why* (the gap that used to swallow hours, sometimes days, sometimes a whole night's sleep) is exactly the gap Zero was built to close.

## What I'd actually do

- Write the knowledge skill before you write anything else. The agent's actual intelligence lives less in the model and more in whether it knows your target-group-to-service mismatches and your custom log prefixes ahead of time.
- Start every service on `balanced` budget mode, not `deep`. Reserve `deep` for alerts your on-call rotation already treats as critical: a 45-minute, 48-tool-call budget on a noisy alarm just burns time and tool calls on something that didn't need it.
- Keep memory writes to a single role. I'd resist the temptation to let every subagent save its own findings, even though it feels more "complete": a single synthesizer writing one clean lesson beats five fragments that half-contradict each other.
- Don't skip the anti-hallucination instruction on the background incident extractor. It's one sentence in a prompt and it's the thing standing between "the agent accurately remembers what happened" and "the agent slowly fills its own memory with plausible fiction."
- Treat the "No ECS" / ghost target groups as a real finding the first time you see them, not a diagram footnote. They're a recurring production failure mode, not a one-off.

It's 3:14 A.M. again, somewhere, right now. Some engineer's phone is buzzing on a nightstand.

This time, by the time they've found their glasses, the investigation's already started.

---

### Sources

- [New Relic 2025 Observability Forecast: downtime cost statistics](https://virima.com/blog/it-downtime-cost-statistics/)
- [ITIC 2024 outage cost data, via downtime cost roundup](https://quashbugs.com/blog/downtime-cost-statistics)
- [EMA/BigPanda unplanned outage cost research](https://2wtech.com/?p=21834)
- [Gartner 2014 downtime cost figure, as cited in current roundups](https://thenetworkinstallers.com/blog/cost-of-it-downtime-statistics/)
- [Small business downtime cost figures (Gatling, 2026)](https://www.dotcom-monitor.com/blog/what-is-the-cost-of-downtime/)
- [Google Cloud / Lowe's SRE case study: MTTR reduction](https://cloud.google.com/blog/products/devops-sre/how-lowes-improved-incident-response-processes-with-sre)
