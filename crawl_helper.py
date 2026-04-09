import asyncio
import json
import sys
import argparse
from crawl4ai import AsyncWebCrawler, BrowserConfig, CrawlerRunConfig, CacheMode

async def crawl_profile(url):
    browser_config = BrowserConfig(
        headless=True,
        text_mode=True,
        light_mode=True
    )
    
    run_config = CrawlerRunConfig(
        cache_mode=CacheMode.BYPASS
    )

    async with AsyncWebCrawler(config=browser_config) as crawler:
        result = await crawler.arun(
            url=url,
            config=run_config
        )
        
        if result.success:
            return {
                "success": True,
                "markdown": result.markdown,
                "metadata": result.metadata
            }
        else:
            return {
                "success": False,
                "error": result.error_message
            }

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Helper Crawl4AI")
    parser.add_argument("url", help="URL à scraper")
    args = parser.parse_args()

    try:
        res = asyncio.run(crawl_profile(args.url))
        print(json.dumps(res, ensure_ascii=False))
    except Exception as e:
        print(json.dumps({"success": False, "error": str(e)}))
