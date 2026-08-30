import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";
import { fetchWeather, TOKYO_COORDINATES } from "@/lib/weather";
import { authenticate } from "../_lib/auth";

/**
 * GET /api/v1/weather?lat=xx&lng=xx
 * Widget 用の天気情報。Open-Meteo から現在天気と本日の最高/最低気温を取得する。
 * lat/lng 省略時は東京。Open-Meteo 失敗時は 200 で従来モックにフォールバックし、
 * クライアント(Widget)を壊さない。
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const latParam = Number(url.searchParams.get("lat"));
  const lngParam = Number(url.searchParams.get("lng"));
  const hasCoords = Number.isFinite(latParam) && Number.isFinite(lngParam);
  const lat = hasCoords ? latParam : TOKYO_COORDINATES.lat;
  const lng = hasCoords ? lngParam : TOKYO_COORDINATES.lng;

  try {
    const weather = await fetchWeather(lat, lng);
    return NextResponse.json({
      mock: false,
      coordinates: { lat, lng },
      weather,
    });
  } catch (err) {
    logger.warn("天気取得に失敗したためモックにフォールバック", {
      lat,
      lng,
      error: err instanceof Error ? err.message : String(err),
    });
    return NextResponse.json({
      mock: true,
      coordinates: { lat, lng },
      weather: {
        condition: "sunny",
        temperatureC: 22,
        updatedAt: new Date().toISOString(),
      },
    });
  }
}
