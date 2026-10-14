export enum CampaignStatus {
  Live = "live",
  Exhausted = "exhausted",
}

export enum Platform {
  Instagram = "instagram",
  YouTube = "youtube",
}

export enum Role {
  Brand = "brand",
  Creator = "creator",
}

export enum HttpStatus {
  Ok = 200,
  Created = 201,
  BadRequest = 400,
  Unauthorized = 401,
  Forbidden = 403,
  NotFound = 404,
  Conflict = 409,
  InternalServerError = 500,
}

export enum DbState {
  Disconnected = 0,
  Connected = 1,
  Connecting = 2,
  Disconnecting = 3,
}
