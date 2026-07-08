import { NextResponse } from "next/server";
import { authenticate } from "../_lib/auth";

/**
 * GET /api/v1/weather?lat=xx&lng=xx
 * Widget 用の天気情報。データソース(気象庁/OpenWeather等)は未確定のため
 * 現時点ではモックを返す。データソース決定後に差し替える。
 */
export async function GET(request: Request) {
  const auth = await authenticate(request);
  if (!auth.ok) return auth.response;

  const url = new URL(request.url);
  const lat = url.searchParams.get("lat");
  const lng = url.searchParams.get("lng");

  return NextResponse.json({
    // TODO: 天気データソース(気象庁 or OpenWeather等)決定後に実装
    mock: true,
    coordinates: lat && lng ? { lat: Number(lat), lng: Number(lng) } : null,
    weather: {
      condition: "sunny",
      temperatureC: 22,
      updatedAt: new Date().toISOString(),
    },
  });
}
