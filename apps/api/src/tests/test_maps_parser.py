import asyncio
import logging
from src.core.parser import link_parser

# Configure logging
logging.basicConfig(level=logging.INFO)

async def test_maps_parsing():
    # Example URL: Ho Chi Minh Statue
    test_url = "https://www.google.com/maps/place/Ho+Chi+Minh+Statue/@10.7760773,106.7009477,17z/data=!3m1!4b1!4m6!3m5!1s0x31752f474c153723:0xa5c4943f96602336!8m2!3d10.7760773!4d106.7031364!16s%2Fg%2F11b66b4k_m?entry=ttu"
    
    print(f"Testing URL: {test_url}")
    result = await link_parser.fetch_place_info(test_url)
    
    print("\n--- Result ---")
    import json
    print(json.dumps(result, indent=2, ensure_ascii=False))

if __name__ == "__main__":
    asyncio.run(test_maps_parsing())
