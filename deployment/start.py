"""Bind the production app to Render's assigned port."""
import os
import uvicorn

if __name__ == "__main__":
    uvicorn.run("deployment.web:app", host="0.0.0.0", port=int(os.getenv("PORT", "10000")), workers=1,
                proxy_headers=True, forwarded_allow_ips=os.getenv("FORWARDED_ALLOW_IPS", "127.0.0.1"))
