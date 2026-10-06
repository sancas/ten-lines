import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import useLocalStorage from "./useLocalStorage";
import { fixGameConsole } from "../tenLines";

export interface SharedGameProfile {
    game: string;
    gameConsole: string;
    trainerID: string;
    secretID: string;
}

export const GAME_LABELS: Record<string, string> = {
    r_painting: "Ruby Painting Seed",
    s_painting: "Sapphire Painting Seed",
    e_painting: "Emerald Painting Seed",
    fr: "FireRed (ENG)",
    fr_eu: "FireRed (SPA/FRE/ITA/GER)",
    fr_jpn_1_0: "FireRed (JPN) (1.0)",
    fr_jpn_1_1: "FireRed (JPN) (1.1)",
    fr_nx: "Switch FireRed (ENG/SPA/FRE/ITA/GER)",
    fr_jpn_nx: "Switch FireRed (JPN)",
    fr_mgba: "FireRed (ENG) (MGBA 10.5)",
    lg: "LeafGreen (ENG)",
    lg_eu: "LeafGreen (SPA/FRE/ITA/GER)",
    lg_jpn: "LeafGreen (JPN)",
    lg_nx: "Switch LeafGreen (ENG/SPA/FRE/ITA/GER)",
    lg_jpn_nx: "Switch LeafGreen (JPN)",
    lg_mgba: "LeafGreen (ENG) (MGBA 10.5)",
};

export const CONSOLE_LABELS: Record<string, string> = {
    GBA: "Game Boy Advance",
    GBP: "Game Boy Player",
    NDS: "Nintendo DS",
    "3DS": "Nintendo 3DS (open_agb_firm)",
    NX: "Nintendo Switch 1",
    NX2: "Nintendo Switch 2",
};

export function getGameLabel(game: string): string {
    return GAME_LABELS[game] || game;
}

export function getConsoleLabel(console: string): string {
    return CONSOLE_LABELS[console] || console;
}

export function useGameSettings() {
    const [searchParams, setSearchParams] = useSearchParams();

    // Primary global storage for game settings
    const [storedProfile, setStoredProfile] = useLocalStorage<SharedGameProfile>(
        "ten-lines-shared-profile",
        {
            game: "fr",
            gameConsole: "GBA",
            trainerID: "0",
            secretID: "0",
        }
    );

    // Also check legacy storage for backwards compatibility if shared profile is default
    const [legacyCalib] = useLocalStorage<Record<string, any>>(
        "calibration-url-state",
        {}
    );
    const [legacySearcher] = useLocalStorage<Record<string, any>>(
        "searcher-url-state",
        {}
    );

    const initialGame =
        searchParams.get("game") ||
        storedProfile.game ||
        legacyCalib.game ||
        legacySearcher.game ||
        "fr";

    const rawConsole =
        searchParams.get("gameConsole") ||
        storedProfile.gameConsole ||
        legacyCalib.gameConsole ||
        "GBA";

    const game = initialGame;
    const gameConsole = fixGameConsole(game, rawConsole);

    const trainerID =
        searchParams.get("trainerID") ||
        storedProfile.trainerID ||
        legacySearcher.trainerID ||
        legacyCalib.trainerID ||
        "0";

    const secretID =
        searchParams.get("secretID") ||
        storedProfile.secretID ||
        legacySearcher.secretID ||
        legacyCalib.secretID ||
        "0";

    const isSwitch = game.endsWith("nx");
    const isFRLG = game.startsWith("fr") || game.startsWith("lg");
    const isFRLGE = isFRLG || game.startsWith("e_");

    // Unified updater that updates both localStorage and searchParams atomically
    const updateGameSettings = useCallback(
        (updates: Partial<SharedGameProfile>) => {
            const nextGame = updates.game !== undefined ? updates.game : game;
            let nextConsole =
                updates.gameConsole !== undefined
                    ? updates.gameConsole
                    : gameConsole;

            // Automatically adapt console if game changed between Switch and non-Switch
            nextConsole = fixGameConsole(nextGame, nextConsole);

            const nextTrainerID =
                updates.trainerID !== undefined ? updates.trainerID : trainerID;
            const nextSecretID =
                updates.secretID !== undefined ? updates.secretID : secretID;

            const newProfile: SharedGameProfile = {
                game: nextGame,
                gameConsole: nextConsole,
                trainerID: nextTrainerID,
                secretID: nextSecretID,
            };

            setStoredProfile(newProfile);

            // Also synchronize legacy storages so old components don't desync
            try {
                const calibRaw = localStorage.getItem("calibration-url-state");
                const calibObj = calibRaw ? JSON.parse(calibRaw) : {};
                calibObj.game = nextGame;
                calibObj.gameConsole = nextConsole;
                calibObj.trainerID = nextTrainerID;
                calibObj.secretID = nextSecretID;
                localStorage.setItem("calibration-url-state", JSON.stringify(calibObj));
                window.dispatchEvent(
                    new CustomEvent("local-storage-calibration-url-state", {
                        detail: calibObj,
                    })
                );

                const searcherRaw = localStorage.getItem("searcher-url-state");
                const searcherObj = searcherRaw ? JSON.parse(searcherRaw) : {};
                searcherObj.game = nextGame;
                searcherObj.trainerID = nextTrainerID;
                searcherObj.secretID = nextSecretID;
                localStorage.setItem("searcher-url-state", JSON.stringify(searcherObj));
                window.dispatchEvent(
                    new CustomEvent("local-storage-searcher-url-state", {
                        detail: searcherObj,
                    })
                );
            } catch (err) {
                console.error("Error updating legacy storage:", err);
            }

            // Sync to URL parameters
            setSearchParams((prev) => {
                prev.set("game", nextGame);
                prev.set("gameConsole", nextConsole);
                prev.set("trainerID", nextTrainerID);
                prev.set("secretID", nextSecretID);
                return prev;
            });
        },
        [game, gameConsole, trainerID, secretID, setStoredProfile, setSearchParams]
    );

    const setGame = useCallback(
        (newGame: string) => {
            updateGameSettings({ game: newGame });
        },
        [updateGameSettings]
    );

    const setGameConsole = useCallback(
        (newConsole: string) => {
            updateGameSettings({ gameConsole: newConsole });
        },
        [updateGameSettings]
    );

    const setTrainerID = useCallback(
        (newTrainerID: string) => {
            updateGameSettings({ trainerID: newTrainerID });
        },
        [updateGameSettings]
    );

    const setSecretID = useCallback(
        (newSecretID: string) => {
            updateGameSettings({ secretID: newSecretID });
        },
        [updateGameSettings]
    );

    return {
        game,
        gameConsole,
        trainerID,
        secretID,
        isSwitch,
        isFRLG,
        isFRLGE,
        setGame,
        setGameConsole,
        setTrainerID,
        setSecretID,
        updateGameSettings,
    };
}

export default useGameSettings;
