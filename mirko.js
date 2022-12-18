import https from "https";
import crypto from "crypto";
import inquirer from "inquirer";
import fs from "fs";

// ONLY API KEYS
import { SECRET_KEY, API_KEY } from "./constants.js";

const CHARITY_SUCESSFULL_DRAW =
    "Losowanie poprawne - dodaj zwyciężcę z puli charytatywnej!",
  PERSONAL_SUCESSFULL_DRAW =
    "Losowanie poprawne - dodaj zwyciężcę z puli personalnej!",
  DRAW_FAILED_WRONG_POOL =
    "Losowanie nieudane - w danej puli jest już zwyciężca :() ",
  DRAW_FAILED_INVALID_REQUEST =
    "Losowanie nieudane - prośba niezgodna z regulaminem rozdajo";

const getRequestHash = ({ secret, requestUrl }) => {
  return crypto
    .createHash("md5")
    .update(secret + requestUrl)
    .digest("hex");
};

const perfomRequest = ({ url, loadingLabel }) => {
  return new Promise((resolve) => {
    https
      .get(
        url,
        {
          headers: {
            apisign: getRequestHash({ secret: SECRET_KEY, requestUrl: url }),
          },
        },
        (resp) => {
          console.log(loadingLabel);
          let data = "";

          resp.on("data", (chunk) => {
            data += chunk;
          });

          resp.on("end", () => {
            const parsedData = JSON.parse(data);
            resolve(parsedData.data);
          });
        }
      )
      .on("error", (err) => {
        console.log("Error: " + err.message);
      });
  });
};

const draw = (upvoters, comments, drawResults) => {
  if (drawResults.charityPool && drawResults.personalPool) {
    console.log("Rozdanie zakończone");
    console.log(
      `\x1b[36mWygranym puli charytatywnej zostaje: ${drawResults.charityPool.user}\x1b[0m`
    );
    console.log(
      `\x1b[36mWygranym puli personalnej zostaje: ${drawResults.personalPool.user}\x1b[0m`
    );
    return;

    // Koniec mistrzostw, do widzenia.
  }

  const {
    author: { login: potentionalWinner },
  } = upvoters[Math.floor(Math.random() * upvoters.length)];

  const comment = comments.find(
    (comment) => comment.author.login === potentionalWinner
  );

  console.clear();

  console.log(`Losowanie...`);
  console.log(`\x1b[33mOsobą wylosowaną zostaje: ${potentionalWinner}\x1b[0m`);
  console.log(`\x1b[33mKomentarz wylosowanej osoby: ${comment?.body}\x1b[0m`);

  inquirer
    .prompt([
      {
        type: "list",
        name: "selectedOption",
        message: "Wybierz opcję:",
        choices: [
          ...(!drawResults.charityPool ? [CHARITY_SUCESSFULL_DRAW] : []),
          ...(!drawResults.personalPool ? [PERSONAL_SUCESSFULL_DRAW] : []),
          DRAW_FAILED_WRONG_POOL,
          DRAW_FAILED_INVALID_REQUEST,
        ],
      },
    ])
    .then((answers) => {
      const selectedOption = answers.selectedOption;

      if (selectedOption === CHARITY_SUCESSFULL_DRAW) {
        drawResults.charityPool = {
          user: potentionalWinner,
          message: comment,
        };
      }

      if (selectedOption === PERSONAL_SUCESSFULL_DRAW) {
        drawResults.personalPool = {
          user: potentionalWinner,
          message: comment,
        };
      }

      draw(upvoters, comments, drawResults);
    });
};

const initializeDraw = async () => {
  const upvoters = await perfomRequest({
    url: `https://a2.wykop.pl/Entries/Upvoters/69502969/appkey/${API_KEY}`,
    loadingLabel: "Pobieranie listy głosujących...",
  });

  const { comments } = await perfomRequest({
    url: `https://a2.wykop.pl/Entries/Entry/69502969/appkey/${API_KEY}`,
    loadingLabel: "Pobieranie listy komentarzy...",
  });

  // No new accounts; Comment in entry
  const allowedUpvoters = upvoters.filter((upvoter) =>
    comments.find(
      (comment) =>
        comment.author.login === upvoter.author.login &&
        comment.author.color !== 0
    )
  );

  const drawResults = {
    charityPool: null,
    personalPool: null,
  };

  console.log(`Pobrano ${upvoters.length} plusujących`);
  console.log(`Pobrano ${comments.length} komentarzy`);

  console.log(`Uprawnionych do losowania ${allowedUpvoters.length} osób`);

  fs.appendFile(
    "participants.txt",
    JSON.stringify(allowedUpvoters.map((voters) => voters.author.login)),
    function (err) {
      console.log("Zapisano listę uzytkwników");
    }
  );

  setTimeout(() => {
    draw(allowedUpvoters, comments, drawResults);
  }, 3000);
};

initializeDraw();
