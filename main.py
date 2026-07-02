import os
import io
import json
from typing import List, Optional
from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field
from PIL import Image
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

app = FastAPI(
    title="FarmAssist AI - Smart Farming Agent",
    description="A multi-agent smart farming assistant for crop disease detection, weather risk mitigation, and market price tracking.",
    version="1.0.0"
)

# Enable CORS for local testing
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Initialize Google GenAI client
api_key = os.environ.get("GEMINI_API_KEY")
client = None

if api_key:
    try:
        from google import genai
        from google.genai import types
        client = genai.Client(api_key=api_key)
        print("Gemini client successfully initialized.")
    except Exception as e:
        print(f"Error initializing Gemini client: {e}. Falling back to MOCK MODE.")
else:
    print("WARNING: GEMINI_API_KEY is not set. FarmAssist AI will run in MOCK MODE.")

# --- PYDANTIC SCHEMAS ---

class DiseaseDiagnosis(BaseModel):
    crop_type: str = Field(description="The detected crop type, e.g. Tomato, Rice, Wheat")
    has_disease: bool = Field(description="True if a disease or health issue is detected, False if healthy")
    disease_name: str = Field(description="Name of the detected disease/issue (or 'Healthy' if none)")
    confidence: str = Field(description="Confidence level of diagnosis: Low, Medium, or High")
    symptoms: List[str] = Field(description="List of symptoms visible in the image")
    explanation: str = Field(description="Brief explanation of the diagnosis and visible symptoms")

class TreatmentPlan(BaseModel):
    organic_treatments: List[str] = Field(description="Organic or biological treatment options")
    chemical_treatments: List[str] = Field(description="Chemical treatment options (use with caution)")
    preventive_measures: List[str] = Field(description="Preventive measures to avoid future occurrences")
    best_practices: List[str] = Field(description="General farming best practices for this crop")

class CropAnalysisResponse(BaseModel):
    diagnosis: DiseaseDiagnosis
    treatment: TreatmentPlan

class WeatherDayForecast(BaseModel):
    day: str = Field(description="e.g. Monday, Day 1")
    temp_high: int = Field(description="High temperature in Celsius")
    temp_low: int = Field(description="Low temperature in Celsius")
    condition: str = Field(description="Weather condition (e.g. Sunny, Rain, Cloudy, Stormy)")
    precipitation_probability: int = Field(description="0 to 100 percentage")

class WeatherRisk(BaseModel):
    risk_level: str = Field(description="Low, Medium, or High")
    title: str = Field(description="Short risk title, e.g. Frost Alert, Heavy Rainfall Warning")
    description: str = Field(description="Description of the risk and impact on the crop")
    recommendation: str = Field(description="What the farmer should do, e.g. cover crops, adjust irrigation schedule")

class WeatherAnalysisResponse(BaseModel):
    location: str
    crop: str
    forecast: List[WeatherDayForecast]
    risks: List[WeatherRisk]

class PricePoint(BaseModel):
    month: str = Field(description="e.g. Jan, Feb, Mar")
    price: float = Field(description="Average price in USD or local currency per kg/ton")

class NearbyMarket(BaseModel):
    market_name: str = Field(description="Name of the market")
    distance_km: float = Field(description="Distance in kilometers")
    current_price: float = Field(description="Current average price per kg at this market")

class MarketAnalysisResponse(BaseModel):
    crop: str
    currency: str = Field(description="e.g. USD, INR, EUR")
    unit: str = Field(description="e.g. kg, quintal, ton")
    current_avg_price: float
    six_month_trend: List[PricePoint]
    three_month_forecast: List[PricePoint]
    nearby_markets: List[NearbyMarket]
    market_insights: str = Field(description="Detailed narrative explaining market trends and advice on when to sell")

# --- MOCK DATA GENERATORS (FALLBACK) ---

def get_mock_crop_analysis(crop_name: str = "Tomato") -> CropAnalysisResponse:
    return CropAnalysisResponse(
        diagnosis=DiseaseDiagnosis(
            crop_type=crop_name,
            has_disease=True,
            disease_name="Early Blight (Alternaria solani)",
            confidence="High",
            symptoms=[
                "Dark, concentric spots resembling bullseyes on older leaves",
                "Leaf yellowing surrounding the spots",
                "Lower leaves dropping prematurely"
            ],
            explanation="The leaves exhibit classic signs of Early Blight, a fungal disease common in warm, humid conditions. It starts on lower leaves and progresses upwards, potentially defoliating the plant and reducing yield."
        ),
        treatment=TreatmentPlan(
            organic_treatments=[
                "Apply copper-based organic fungicides or neem oil.",
                "Remove and destroy infected lower leaves to reduce spore spread.",
                "Mulch the soil base to prevent soil-borne spores from splashing onto leaves."
            ],
            chemical_treatments=[
                "Apply chlorothalonil or mancozeb-based fungicides at the first sign of disease.",
                "Rotate with difenoconazole or azoxystrobin for resistance management."
            ],
            preventive_measures=[
                "Practice a 3-year crop rotation, avoiding nightshade family crops (potatoes, eggplants, peppers).",
                "Water at the base of the plant (drip irrigation) to keep leaves dry.",
                "Ensure proper plant spacing for air circulation."
            ],
            best_practices=[
                "Stake plants off the ground to improve airflow.",
                "Plant blight-resistant tomato varieties in the future.",
                "Prune the bottom 12 inches of foliage once the plant reaches maturity."
            ]
        )
    )

def get_mock_weather_analysis(location: str, crop: str) -> WeatherAnalysisResponse:
    return WeatherAnalysisResponse(
        location=location,
        crop=crop,
        forecast=[
            WeatherDayForecast(day="Monday", temp_high=32, temp_low=22, condition="Sunny", precipitation_probability=10),
            WeatherDayForecast(day="Tuesday", temp_high=33, temp_low=23, condition="Sunny", precipitation_probability=15),
            WeatherDayForecast(day="Wednesday", temp_high=34, temp_low=24, condition="Cloudy", precipitation_probability=30),
            WeatherDayForecast(day="Thursday", temp_high=31, temp_low=21, condition="Heavy Rain", precipitation_probability=85),
            WeatherDayForecast(day="Friday", temp_high=28, temp_low=20, condition="Thunderstorms", precipitation_probability=90),
            WeatherDayForecast(day="Saturday", temp_high=29, temp_low=21, condition="Showers", precipitation_probability=60),
            WeatherDayForecast(day="Sunday", temp_high=31, temp_low=22, condition="Cloudy", precipitation_probability=20),
        ],
        risks=[
            WeatherRisk(
                risk_level="High",
                title="Heavy Rain & Waterlogging Risk",
                description=f"Significant rainfall (85-90% probability) expected on Thursday and Friday. This can lead to root rot and soil erosion for your {crop} crops.",
                recommendation="Ensure all drainage channels are clear. Postpone any planned fertilizer applications until after the rain to prevent runoff."
            ),
            WeatherRisk(
                risk_level="Medium",
                title="Fungal Disease Spurt Alert",
                description="The combination of high temperatures (31-34°C) followed by heavy rain creates a highly humid microclimate, optimal for fungal spore germination.",
                recommendation="Inspect plants closely for signs of mildew or blight post-rainfall. Apply preventive organic sprays if necessary."
            )
        ]
    )

def get_mock_market_analysis(crop: str) -> MarketAnalysisResponse:
    # Set default currency/unit based on crop/location context
    return MarketAnalysisResponse(
        crop=crop,
        currency="USD",
        unit="quintal (100kg)",
        current_avg_price=45.0,
        six_month_trend=[
            PricePoint(month="Jan", price=38.0),
            PricePoint(month="Feb", price=40.0),
            PricePoint(month="Mar", price=42.5),
            PricePoint(month="Apr", price=46.0),
            PricePoint(month="May", price=48.0),
            PricePoint(month="Jun", price=45.0),
        ],
        three_month_forecast=[
            PricePoint(month="Jul", price=43.0),
            PricePoint(month="Aug", price=44.5),
            PricePoint(month="Sep", price=49.0),
        ],
        nearby_markets=[
            NearbyMarket(market_name="Central Wholesale Market", distance_km=12.4, current_price=46.5),
            NearbyMarket(market_name="Green Valley Agri-Hub", distance_km=25.1, current_price=48.0),
            NearbyMarket(market_name="Local Farmer's Co-op", distance_km=5.2, current_price=44.0),
        ],
        market_insights=f"Prices for {crop} reached a seasonal peak in May due to supply constraints. While we expect a slight correction in July/August as new harvests hit nearby markets, price projections show a strong rebound in September. Recommendation: Sell a portion of your harvest now at the Co-op to secure cash flow, and store premium quality crops for September to maximize profits."
    )

# --- API ENDPOINTS ---

@app.post("/api/analyze-crop", response_model=CropAnalysisResponse)
async def analyze_crop(image: UploadFile = File(...)):
    """
    Coordinates Agent 1 (Crop Disease Agent) and Agent 3 (Treatment Agent)
    to diagnose leaf/crop disease and suggest specific treatments.
    """
    if not client:
        # Fallback to mock logic
        print("Mock mode: Returning simulated crop diagnosis.")
        return get_mock_crop_analysis("Tomato (Simulated)")

    try:
        # Read uploaded image bytes
        image_bytes = await image.read()
        pil_image = Image.open(io.BytesIO(image_bytes))

        # Build combined prompt for Disease and Treatment Agents
        prompt = """
        You are FarmAssist AI, a dual-agent farming assistant consisting of:
        1. Crop Disease Agent: Specialized in detecting crop types, diseases, pests, nutrient deficiencies, or structural health issues from photos.
        2. Treatment Agent: Specialized in recommending organic treatments, chemical controls (with safety precautions), preventive actions, and general best practices.

        Analyze the uploaded image. First, identify the crop. Second, identify if it has any diseases, pests, or deficiencies.
        If you find an issue, fill out the diagnosis and treatment plan details in the requested JSON structure.
        If the crop looks completely healthy, set has_disease=False, disease_name='Healthy', confidence='High', and provide general maintenance best practices and preventive measures for that crop.
        """

        # Call Gemini using the structured response schema
        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=[pil_image, prompt],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=CropAnalysisResponse,
            )
        )
        
        # Parse the JSON response
        result_json = json.loads(response.text)
        return CropAnalysisResponse(**result_json)

    except Exception as e:
        print(f"API Error in analyze_crop: {e}")
        # Return fallback on API failure
        return get_mock_crop_analysis("Crop (Fallback)")


@app.get("/api/weather", response_model=WeatherAnalysisResponse)
async def analyze_weather(location: str, crop: str):
    """
    Coordinates Agent 2 (Weather Agent) to fetch weather forecast
    and evaluate crop-specific weather risks.
    """
    if not client:
        print("Mock mode: Returning simulated weather analysis.")
        return get_mock_weather_analysis(location, crop)

    try:
        prompt = f"""
        You are FarmAssist AI's Weather Agent. Your task is to evaluate weather-related risks for growing '{crop}' in the region '{location}'.
        
        1. Generate a realistic 7-day forecast for '{location}' (including temperature range, conditions, and rain probability).
        2. Analyze specific risks (e.g., frost, drought, extreme heat, flood, high humidity) that could harm a '{crop}' crop based on this forecast.
        3. Formulate practical recommendations to mitigate these risks.
        
        Provide the response structured exactly as the requested JSON schema.
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=WeatherAnalysisResponse,
            )
        )

        result_json = json.loads(response.text)
        return WeatherAnalysisResponse(**result_json)

    except Exception as e:
        print(f"API Error in analyze_weather: {e}")
        return get_mock_weather_analysis(location, crop)


@app.get("/api/market", response_model=MarketAnalysisResponse)
async def analyze_market(crop: str, location: Optional[str] = "General"):
    """
    Coordinates Agent 4 (Market Agent) to provide price trends, nearby market details, and sales recommendations.
    """
    if not client:
        print("Mock mode: Returning simulated market analysis.")
        return get_mock_market_analysis(crop)

    try:
        prompt = f"""
        You are FarmAssist AI's Market Agent. Your task is to provide market intelligence for the crop '{crop}' in the region/country '{location}'.
        
        1. Provide the current average wholesale price, along with the currency and unit (e.g., USD/quintal, INR/ton, etc.).
        2. Generate a 6-month historical price trend (month-by-month average prices).
        3. Project a 3-month future price forecast.
        4. List 3 realistic local wholesale markets/co-ops with distances and price comparison.
        5. Provide a strategic narrative with insights (e.g., market advice, seasonal demands, whether to sell now or store).
        
        Provide the response structured exactly as the requested JSON schema.
        """

        response = client.models.generate_content(
            model="gemini-2.5-flash",
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=MarketAnalysisResponse,
            )
        )

        result_json = json.loads(response.text)
        return MarketAnalysisResponse(**result_json)

    except Exception as e:
        print(f"API Error in analyze_market: {e}")
        return get_mock_market_analysis(crop)


# Mount static files to serve the frontend
# We will create the static directory to hold index.html, style.css, and app.js
static_dir_path = os.path.join(os.path.dirname(__file__), "static")
os.makedirs(static_dir_path, exist_ok=True)

# Mount the static files
app.mount("/", StaticFiles(directory=static_dir_path, html=True), name="static")

if __name__ == "__main__":
    import uvicorn
    # Cloud Run binds to $PORT env variable, default is 8080
    port = int(os.environ.get("PORT", 8080))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=True)
