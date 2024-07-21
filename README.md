# ✨ Give a star if this works ✨

## Setup
click [![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FM1noa%2Fdiscord-webhook-proxy&env=WEBHOOK_ID,WEBHOOK_CODE&envDescription=discord.com%2Fapi%2Fwebhooks%2F%7BTHIS%20IS%20THE%20ID!!%7D%2F%7BTHIS%20IS%20THE%20CODE!!!%7D&project-name=webhookproxy&repository-name=Webhook-Proxy) and go through the setup properly, the link vercel gives will work as the discrod webhook link


## Other
If you have any issues make a detailed issues report or hmu at github@minoa.cat or minoa.cat on discord


p.s. to change the rate limit go to the github repo that vercel makes and go into the index.js and edit the stuff under ```const rateLimitMiddleware = rateLimit({```

vercel seems to proxy everything so the rate limit is shared, but if you use something other than vercel it might be per IP

this will also bypass anyone blocking the https://discord.com/api/webhooks domain, like if an extention blocks it for security this will bypass it
