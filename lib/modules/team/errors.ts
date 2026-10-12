type RpcError = {
  code: string;
  message: string;
  details?: string | null;
  hint?: string | null;
};

// SQLSTATE codes raised by database/950_team_module.sql and
// database/960_pilot_owner_access.sql.
const MESSAGES: Record<string, string> = {
  "22023": "Some of the details are not valid. Check them and try again.",
  "42501": "Only an active owner can do this.",
  P0002: "This item no longer exists. Refresh the page and try again.",
  RL001: "This person is already on your team.",
  RL002: "Your team is full. Remove a member or cancel an invitation first.",
  RL003: "This invitation has already been used.",
  RL004: "This invitation was cancelled. Ask the café owner for a new one.",
  RL005: "This invitation has expired. Ask the café owner for a new one.",
  RL006: "This invitation was sent to a different Google account.",
  RL007: "This account already belongs to another café.",
  RL008: "You cannot remove yourself from the team.",
  RL022: "This report was already dismissed.",
  RL023: "This report was already accepted into a ticket.",
  RL010: "This account already belongs to a café.",
  RL011: "This account has not been invited to the RepairLog pilot yet.",
  "23514": "A café must keep at least one owner.",
};

export function mapTeamError(scope: string, error: RpcError, fallback: string) {
  console.error(`${scope} failed`, {
    code: error.code,
    message: error.message,
    details: error.details,
    hint: error.hint,
  });

  const known = MESSAGES[error.code];
  if (known) {
    return known;
  }

  if (process.env.NODE_ENV === "development") {
    if (error.code === "PGRST202") {
      return "The team database functions are not installed yet. Run database/950_team_module.sql.";
    }

    return `Database error ${error.code}: ${error.message}`;
  }

  return fallback;
}

export function isInvitationToken(value: string) {
  return /^[0-9a-f]{64}$/.test(value);
}

export function isEmail(value: string) {
  return value.length <= 320 && /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}
