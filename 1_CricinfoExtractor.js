// node 1_CricinfoExtractor.js --excel=worldcup.csv --dataFolder=data --source=https://www.espncricinfo.com/series/icc-cricket-world-cup-2019-1144415/match-results

let minimist = require("minimist");
let axios = require("axios");
let jsdom = require("jsdom");
let excel = require("excel4node");
let pdf = require("pdf-lib");
let fs = require("fs");
let path = require("path");
const { alignment } = require("excel4node/distribution/lib/types");

let args = minimist(process.argv);

let responsePromise = axios.get(args.source);
responsePromise.then(function(response){
    let html = response.data;

    let dom = new jsdom.JSDOM(html); 
    let document = dom.window.document; 

    let matches = []; 
    let matchDivs = document.querySelectorAll("div.match-score-block");
    for(let i = 0; i < matchDivs.length; i++){
        let matchDiv = matchDivs[i];
        let match = {
            t1: "",
            t2: "",
            t1Score: "",
            t2Score: "",
            result: ""
        }

        let teamParas = matchDiv.querySelectorAll("div.name-detail > p.name"); 
        match.t1 = teamParas[0].textContent;
        match.t2 = teamParas[1].textContent;

        let scoreSpans = matchDiv.querySelectorAll("div.score-detail > span.score"); 
        if(scoreSpans.length == 2){ 
            match.t1Score = scoreSpans[0].textContent;
            match.t2Score = scoreSpans[1].textContent;
        }else if(scoreSpans.length == 1){ 
            match.t1Score = scoreSpans[0].textContent;
            match.t2Score = "";
        }else{
            match.t1Score = "";
            match.t2Score = ""; 
        }

        let resultSpan = matchDiv.querySelector("div.status-text > span"); 
        match.result = resultSpan.textContent;

        matches.push(match); 
    }

    let matchesJSON = JSON.stringify(matches);
    fs.writeFileSync("matches.JSON", matchesJSON, "utf-8");

    let teams = []; 
    for(i = 0; i < matches.length; i++){
        putTeamInTeamsArrayIfMissing(teams, matches[i]);
    }

    for(i = 0; i < matches.length; i++){
        putMatchesInAppropriateTeam(teams, matches[i]);
    }
    let teamsJSON = JSON.stringify(teams); 
    fs.writeFileSync("teams.JSON", teamsJSON, "utf-8");

    createExcelFile(teams);
    createFolders(teams);

 });

 function createFolders(teams){
     fs.mkdirSync(args.dataFolder);
     for(i = 0; i < teams.length; i++){
         let teamFN = path.join(args.dataFolder, teams[i].name);
         fs.mkdirSync(teamFN);
     

        for(let j = 0; j < teams[i].matches.length; j++){
            let matchFileName = path.join(teamFN, teams[i].matches[j].vs + ".pdf");
            createScoreCard(teams[i].name, teams[i].matches[j], matchFileName);
        }
     }
 }

 function createScoreCard(teamName, match, matchFileName){

    let t1 = teamName;
    let t2 = match.vs;
    let t1s = match.selfScore;
    let t2s = match.oppScore;
    let result = match.result;

    let originalBytes = fs.readFileSync("Template1.pdf");

    let promiseToLoadBytes = pdf.PDFDocument.load(originalBytes);
    promiseToLoadBytes.then(function(pdfdoc){
        let page = pdfdoc.getPage(0);
        page.drawText(t1, {
            x: 210,
            y: 682,
            size: 13
        });
        page.drawText(t2, {
            x: 210,
            y: 642,
            size: 13
        });
        page.drawText(t1s, {
            x: 210,
            y: 605,
            size: 13
        });
        page.drawText(t2s, {
            x: 210,
            y: 565,
            size: 13
        });
        page.drawText(result, {
            x: 210,
            y: 526,
            size: 13
        });
        let promiseToSave = pdfdoc.save();
        promiseToSave.then(function(changedBytes){
            fs.writeFileSync(matchFileName, changedBytes);
        });
    });
}

 function createExcelFile(teams){
     let wb = new excel.Workbook();

     let centerStyle = wb.createStyle({
        alignment:{
            horizontal: ["center"],
            vertical: ["center"]
        }
     });

     let teamStyle = wb.createStyle({
        font: {
            bold: true,
            size: 15
        }
    }); 

     let headerStyle = wb.createStyle({
        font: {
            bold: true,
            size: 18,
            color: "#1E5128"
        },
        fill: {
            type: "pattern",
            patternType: "solid",
            fgColor: "#BCCC9A"
        }
    }); 

     for(let i = 0; i < teams.length; i++){
         let sheet = wb.addWorksheet(teams[i].name);

         sheet.row(1).setHeight(20);
         sheet.row(2).setHeight(22);
         sheet.row(3).setHeight(22);
         sheet.row(4).setHeight(22);
         sheet.row(5).setHeight(22);
         sheet.row(6).setHeight(22);
         sheet.row(7).setHeight(22);
         sheet.row(8).setHeight(22);
         sheet.row(9).setHeight(22);
         sheet.row(10).setHeight(22);
         sheet.row(11).setHeight(22);
         sheet.row(12).setHeight(22);
         sheet.column(1).setWidth(25);
         sheet.column(2,3).setWidth(15);
         sheet.column(4).setWidth(50);
         sheet.cell(1,1).string("vs").style(headerStyle).style(centerStyle);
         sheet.cell(1,2).string("Self Score").style(headerStyle).style(centerStyle);
         sheet.cell(1,3).string("Opp Score").style(headerStyle).style(centerStyle);
         sheet.cell(1,4).string("Result").style(headerStyle).style(centerStyle);

         for(let j = 0; j < teams[i].matches.length; j++){
             sheet.cell(2 + j, 1).string(teams[i].matches[j].vs).style(teamStyle).style(centerStyle);
             sheet.cell(2 + j, 2).string(teams[i].matches[j].selfScore).style(centerStyle);
             sheet.cell(2 + j, 3).string(teams[i].matches[j].oppScore).style(centerStyle);
             sheet.cell(2 + j, 4).string(teams[i].matches[j].result).style(centerStyle);
         }
     }

     wb.write(args.excel);
 }


function putTeamInTeamsArrayIfMissing(teams, match){
    let t1Index = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t1){
            t1Index = i;
            break;
        }
    }

    if(t1Index == -1){
        teams.push({
            name: match.t1,
            matches: []
        });
    }


    // For team 2
    let t2Index = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t2){
            t2Index = i;
            break;
        }
    }

    if(t2Index == -1){
        teams.push({
            name: match.t2,
            matches: []
        });
    }
}

function putMatchesInAppropriateTeam(teams, match){
    let t1Index = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t1){
            t1Index = i;
            break;
        }
    }

    let team1 = teams[t1Index];
    team1.matches.push({
        vs: match.t2,
        selfScore: match.t1Score,
        oppScore: match.t2Score,
        result: match.result
    });

    let t2Index = -1;
    for(let i = 0; i < teams.length; i++){
        if(teams[i].name == match.t2){
            t2Index = i;
            break;
        }
    }

    let team2 = teams[t2Index];
    team2.matches.push({
        vs: match.t1,
        selfScore: match.t2Score,
        oppScore: match.t1Score,
        result: match.result
    });
}
