### Everything else (the registry, the retraining, the CI/CD, the monitoring) turned out to be the actual project.

I started this on December 30th, sitting in my room with a half-finished nutrition degree's worth of free time and a CSV of Albany, NY Airbnb listings I'd pulled together myself. The first commit just handled null values. That's it. No model, no pipeline, nothing you'd show anyone.

Six months later, through feature engineering, DVC, MLflow, a Terraform-provisioned AWS stack, a GitHub Actions deploy pipeline, and a Prometheus/Grafana setup I didn't know I'd need, I had something I'd actually call a system. Not a notebook. A system.

The regression model at the center of it, an XGBoost regressor with four hyperparameters I never even tuned, took maybe two weeks of that time. The other five and a half months were spent on the part nobody puts in a portfolio screenshot: making sure the model doesn't quietly get worse, doesn't need me to SSH in every time it retrains, and doesn't go down without anyone noticing.

## Resources

<div class="resource-card">
  <a class="resource-link" href="https://github.com/aakashaldankar/Albany-Airbnb-Price-Prediction" target="_blank" rel="noopener noreferrer">
    <svg class="resource-icon" viewBox="0 0 16 16" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z"/>
    </svg>
    <span class="resource-text">
      <span class="resource-title">Code on GitHub</span>
      <span class="resource-desc">the full repo: DVC pipeline, FastAPI service, Terraform, CI/CD, the works.</span>
    </span>
    <svg class="resource-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
      <line x1="5" y1="12" x2="19" y2="12"></line>
      <polyline points="12 5 19 12 12 19"></polyline>
    </svg>
  </a>
</div>

## The problem nobody actually solves well

Most Airbnb hosts set a price once and then forget about it, or they copy whatever the listing down the street is charging and call it research.

Both of those are guesses dressed up as decisions. And guessing in either direction costs money:

- Price too high, and the listing sits empty next to five others that look identical on paper.
- Price too low, and you're leaving money on the table on every single booking, for as long as that price sits there unquestioned.

The annoying part is that nobody tells you which one is happening. There's no little red flag on your listing that says "you're $18 over market." Occupancy just quietly drops, or a competitor undercuts you, and you never connect the dots back to the number you typed in six months ago.

<div class="callout">
<p><span class="callout-label">Takeaway</span>pricing a room is a regression problem wearing a "gut feeling" costume, and almost nobody treats it like one.</p>
</div>

## What I actually built

The short version: you fill in a listing's details (location, room type, how many it sleeps, the host's review history, how far out it's booked) and an XGBoost model hands back a fair nightly price, learned from real Albany-area listings.

![Gradio UI](docs/gradio-ui-albany.png)

The longer version is everything standing behind that one text box:

<div class="pipeline">
  <div class="pipeline-flow">
    <span class="pipeline-flow-label">Prediction request</span>
    <div class="pipeline-step">
      <span class="pipeline-step-label">Host</span>
      <span class="pipeline-step-sub">fills in listing details</span>
    </div>
    <div class="pipeline-arrow"><span>POST /predict</span></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">Gradio UI</span>
    </div>
    <div class="pipeline-arrow"></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">FastAPI</span>
      <span class="pipeline-step-sub">loads champion model</span>
    </div>
    <div class="pipeline-arrow"></div>
    <div class="pipeline-step pipeline-step-accent">
      <span class="pipeline-step-label">MLflow Registry</span>
    </div>
  </div>
  <div class="pipeline-flow">
    <span class="pipeline-flow-label">Nightly retrain · 2am</span>
    <div class="pipeline-step pipeline-step-muted">
      <span class="pipeline-step-label">EventBridge</span>
    </div>
    <div class="pipeline-arrow"><span>dvc repro</span></div>
    <div class="pipeline-step">
      <span class="pipeline-step-label">DVC retrain job</span>
    </div>
    <div class="pipeline-arrow"><span>logs new run, maybe promotes</span></div>
    <div class="pipeline-step pipeline-step-accent">
      <span class="pipeline-step-label">MLflow Registry</span>
    </div>
  </div>
  <div class="pipeline-connector"><span>hot-swap, no restart</span></div>
  <div class="pipeline-step pipeline-step-final">
    <span class="pipeline-step-label">FastAPI</span>
    <span class="pipeline-step-sub">reloads the champion model in memory</span>
  </div>
</div>

| Layer | Tools |
|---|---|
| Modeling | XGBoost, scikit-learn, category-encoders |
| Data validation | Great Expectations |
| Pipeline orchestration | DVC |
| Experiment tracking & registry | MLflow |
| API | FastAPI, Pydantic |
| UI | Gradio |
| Observability | Prometheus, Grafana |
| Cloud infra | AWS (ECS Fargate, ALB, RDS, S3), provisioned with Terraform |
| CI/CD | GitHub Actions, authenticated via OIDC |

Reading that table top to bottom, one line is doing the actual pricing work and the other seven are making sure that line stays honest and stays up. That ratio is the whole point of this post.

## The model itself: deliberately ordinary

I trained on about 5,874 raw Albany-area listings, pulled down to 58 columns of raw signal: location, host stats, amenities, review counts, the usual Airbnb scrape fields. After feature engineering (one-hot encoding on room type, target encoding on neighbourhood and property type, TF-IDF on the listing name and host location, capped at 20 features each), that becomes 95 columns feeding an XGBoost regressor on a 70/30 split: 3,642 training rows, 1,576 held out for testing.

The hyperparameters are almost embarrassingly plain:

| Parameter | Value |
|---|---|
| `n_estimators` | 200 |
| `max_depth` | 6 |
| `learning_rate` | 0.1 |
| `subsample` | 0.8 |

I never ran a grid search. These are close to the first values I tried, they beat the baseline by a comfortable margin, and I moved on. I'm not 100% sure a proper hyperparameter sweep wouldn't move the needle (with 95 features over roughly 5,600 listings it might buy a percent or two), but I never actually checked, and that's a gap I'd close before I'd call this "tuned."

One thing I did get right: price is heavily right-skewed (a handful of listings charging 4–5x the median drags the whole distribution), so the model is trained on `log1p(price)`, not raw price, and every prediction gets `expm1`'d back into dollars before it reaches the UI. Physically, it's the same trick as switching a ramp for stairs: gradient boosting takes more consistent steps on the log scale than it does chasing a long tail of $400+ outlier listings.

The best run I logged came in at a mean absolute error of 0.217 and an RMSE of 0.314, both in log-price space. Converted back to something a human can feel: an RMSE of 0.314 in log space is roughly a factor of e^0.314 ≈ 1.37, so a typical prediction is within about plus-or-minus a third of the actual price, not pennies-accurate. For a first pass with zero tuning, on a market this size, I'll take it. For a model a host should fully trust without a human sanity check, it's not there yet.

<div class="stat-row">
  <div class="stat-card">
    <span class="stat-value">0.217</span>
    <span class="stat-label">MAE (log-price)</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">0.314</span>
    <span class="stat-label">RMSE (log-price)</span>
  </div>
  <div class="stat-card">
    <span class="stat-value">≈37%</span>
    <span class="stat-label">typical price error</span>
  </div>
</div>

<div class="callout">
<p><span class="callout-label">Takeaway</span>the model doesn't need to be clever. It needs to beat "a host's gut feeling," and that's a lower bar than it sounds like.</p>
</div>

## A model is not a product: champion vs. shadow

The part of this project I'm actually proud of isn't the XGBoost model: it's that a new model is never allowed to silently replace a better one.

Every training run gets logged to MLflow and tagged `latest_trained`, no judgment attached. From there, two checks happen before anything touches production: first, does it clear a fixed eligibility bar (MAE, MSE, and RMSE each under 0.5 in log space)? Second, does it actually beat whatever's currently serving real traffic? Only if both are true does it get promoted to `champion`. If it clears the bar but loses to the champion, it's kept as `shadow`: a runner-up, not deleted, not promoted, just benched.

I'll admit the 0.5 threshold is a round number I picked because it felt safely above anything I'd seen, not because I derived it from anything principled. If you pushed me on why 0.5 and not 0.4, I don't have a great answer. It's a baseline sanity check, not a scientifically chosen cutoff.

What it does buy me: "we retrained and it got worse" can never reach a real prediction. The worst outcome of a bad retrain is a model that sits in `shadow` doing nothing, not a model that quietly starts mispricing every listing in Albany.

<div class="callout">
<p><span class="callout-label">Takeaway</span>decide your promotion rule before you need it, not after a retrain has already gone live and gotten worse.</p>
</div>

## Retraining that doesn't need me

The DVC pipeline (ingest, validate, preprocess, engineer features, train, evaluate) runs on its own every night at 2am via an EventBridge schedule, and I can also fire it manually by flipping a flag in the GitHub Actions deploy workflow.

Either way it's the same one-off task, not a service: it runs `dvc repro`, and if a new model just got promoted to `champion`, it calls a `POST /admin/reload` on the FastAPI service so the already-running container picks up the new model in memory, without a restart and without any downtime.

That one endpoint took longer to get right than the XGBoost model did, because getting it wrong means either serving stale predictions after a retrain, or restarting a production service for every model update.

<div class="callout">
<p><span class="callout-label">Takeaway</span>if "the model got better" can't reach production without you doing something by hand, you don't have automation, you have a cron job that pages you.</p>
</div>

## Shipping without a secret sitting in GitHub

Every deploy goes through GitHub Actions, and GitHub Actions never holds a static AWS access key. Instead, it authenticates via OIDC (OpenID Connect; short version: GitHub's workflow gets a short-lived, cryptographically signed token instead of a password) to an IAM role that only trusts tokens where the subject matches `repo:aakashaldankar/Albany-Airbnb-Price-Prediction:ref:refs/heads/main`. Nobody can mint that token except a GitHub Actions run on my `main` branch, and it expires almost immediately.

Compare that to the alternative: an `AWS_ACCESS_KEY_ID` sitting in a GitHub secret, valid until someone remembers to rotate it, which is to say valid roughly forever. OIDC isn't more convenient. It's strictly more annoying to set up. I did it anyway because a leaked long-lived key is a bad weekend, and a leaked OIDC token is a non-event because there's nothing durable to leak.

<div class="callout">
<p><span class="callout-label">Takeaway</span>if your CI pipeline needs AWS credentials, make them expire faster than anyone could misuse them.</p>
</div>

## Watching it so I don't have to

Logs tell you what happened, one line at a time. They don't tell you "is this healthy right now," which is a different question. Prometheus scrapes FastAPI's request counts, latencies, and the actual prediction distribution; Grafana turns that into dashboards, locked down to my own IP through the ALB the same way MLflow's UI is.

I'll be honest: I added this stack mostly because I'd never operated one before, not because this specific project had an incident that demanded it. That's a fine reason to learn a tool. It's a bad reason to claim the dashboards caught something dramatic: they didn't. The value here was entirely in building the muscle, not in a war story.

<div class="callout">
<p><span class="callout-label">Takeaway</span>sometimes you add observability to learn observability, not because you were on fire. Say so instead of inventing a near-miss.</p>
</div>

## What I got wrong

A few honest ones:

- I never tuned the model, and I said why above: I'd fix that before trusting this on a listing I actually owned.
- All of this is trained on roughly 5,800 Albany-area listings scraped at one point in time. It will not generalize to New York City or to a market with different regulations, and I haven't tested that it even degrades gracefully; it might just be confidently wrong somewhere else.
- After deploying the whole stack to AWS ECS Fargate (ALB, RDS, three ECS services) I tore it back down with `terraform destroy`. Running an always-on load balancer, a managed Postgres instance, and Fargate tasks 24/7 costs real money for a project nobody's actually using, and I'd rather spin it up on demand to demo than pay a monthly bill to prove a point. That's not a failure, it's just the honest economics of a portfolio project, but it did mean temporarily killing a live link I'd have liked to keep around.

## What I'd actually do

If you're building your first full-stack ML project:

* Start with XGBoost defaults, not the fanciest architecture you can find. The model is not where your time should go first.
* Build the promotion gate (something beats production, or it doesn't ship) before you build anything that auto-retrains. Automating a bad decision just makes it faster.
* Use OIDC for CI credentials from day one. Retrofitting it after you've already got a static key in a secrets store is more work than starting with it.
* Don't skip monitoring just because the project is small. You don't learn to read a Grafana dashboard under incident pressure for the first time; you learn it here, on a project where nothing's actually on fire.
* Tear infrastructure down when you're not using it. A `terraform destroy` you're willing to run is worth more than a demo link you're quietly paying for.

The open question I don't have an answer to yet: whether I'd build the same AWS-native, multi-service stack again for a project this size, or whether a smaller serverless footprint would've taught me just as much for less of the setup cost. I genuinely don't know. Next project, I'll find out.

---
