import { Box, MenuItem, TextField } from "@mui/material";
import { GAME_LABELS, CONSOLE_LABELS } from "../hooks/useGameSettings";

interface GameConsoleSelectorProps {
    game: string;
    gameConsole: string;
    onGameChange: (game: string) => void;
    onConsoleChange: (gameConsole: string) => void;
    sx?: any;
}

export default function GameConsoleSelector({
    game,
    gameConsole,
    onGameChange,
    onConsoleChange,
    sx,
}: GameConsoleSelectorProps) {
    const isSwitch = game.endsWith("nx");

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: { xs: "column", sm: "row" },
                gap: 2,
                ...sx,
            }}
        >
            <TextField
                label="Game"
                margin="normal"
                style={{ textAlign: "left" }}
                onChange={(event) => onGameChange(event.target.value)}
                value={game}
                select
                fullWidth
            >
                {Object.entries(GAME_LABELS).map(([value, label]) => (
                    <MenuItem key={value} value={value}>
                        {label}
                    </MenuItem>
                ))}
            </TextField>

            <TextField
                label="Console"
                margin="normal"
                style={{ textAlign: "left" }}
                onChange={(event) => onConsoleChange(event.target.value)}
                value={gameConsole}
                select
                fullWidth
            >
                {isSwitch
                    ? [
                          <MenuItem key="NX" value="NX">
                              {CONSOLE_LABELS.NX}
                          </MenuItem>,
                          <MenuItem key="NX2" value="NX2">
                              {CONSOLE_LABELS.NX2}
                          </MenuItem>,
                      ]
                    : [
                          <MenuItem key="GBA" value="GBA">
                              {CONSOLE_LABELS.GBA}
                          </MenuItem>,
                          <MenuItem key="GBP" value="GBP">
                              {CONSOLE_LABELS.GBP}
                          </MenuItem>,
                          <MenuItem key="NDS" value="NDS">
                              {CONSOLE_LABELS.NDS}
                          </MenuItem>,
                          <MenuItem key="3DS" value="3DS">
                              {CONSOLE_LABELS["3DS"]}
                          </MenuItem>,
                      ]}
            </TextField>
        </Box>
    );
}
