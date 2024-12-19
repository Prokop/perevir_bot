function logOut() {
    document.cookie = 'token=; Max-Age=0'
    window.location.href = "../";
}

function updateTexts() {
    const texts = document.getElementsByTagName('textarea');
    var textToUpdate = [];
    for (var i in texts) {
      if (texts[i].id && (texts[i].id.startsWith('u_') || texts[i].id.startsWith('e_'))) { //u_ - ukr, e_ - eng
        const lang = texts[i].id[0];
        const textName = texts[i].id.substring(2);

        const index = textToUpdate.findIndex((obj => obj.name == textName));
        if (index == -1) {
            const textObj = { name: textName };
            if (lang == 'u') textObj.ua = texts[i].value;
            else if (lang == 'e') textObj.en = texts[i].value;
            textToUpdate.push(textObj);
        } else {
            if (lang == 'u') textToUpdate[index].ua = texts[i].value;
            else if (lang == 'e') textToUpdate[index].en = texts[i].value;
        }
      }
    }
    
    fetch("../textsAPI/update", {
        method: "POST",
        headers: {'Content-Type': 'application/json'}, 
        body: JSON.stringify(textToUpdate)
      }).then(res => {
        alert("Зміни збережено");
      });
}

function getLeaderboard() {
  
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;

  fetch("../leaderboardAPI/get?" + new URLSearchParams({
    from: from,
    to: to,
  }))
  .then(response => response.json())
  .then(res => {
    document.getElementById('leaderboard').innerHTML = '';
    var fakes = 0, trues = 0, semitrues = 0, nodatas = 0, rejects = 0, comments = 0, requests = 0;
    for (var i in res) {
      document.getElementById('leaderboard').innerHTML += '<tr> <td class="left-pad"> <h6 class="mb-0 text-sm">' + res[i].name + '</h6> <p class="text-xs text-secondary mb-0">id: '+ res[i].tgId +'</p> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].fakes +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].trues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].semitrues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].nodatas +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].rejects +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ res[i].comments +'</span> </td>  <td class="text-center"> <span class="font-weight-bold">'+ res[i].requests +'</span> </td> </tr>';
      fakes += parseInt(res[i].fakes);
      trues += parseInt(res[i].trues);
      semitrues += parseInt(res[i].semitrues);
      nodatas += parseInt(res[i].nodatas);
      rejects += parseInt(res[i].rejects);
      comments += parseInt(res[i].comments);
      requests += parseInt(res[i].requests);
    }
    document.getElementById('leaderboard').innerHTML += '<tr> <td class="left-pad"> <h6 class="mb-0">Всього: </h6></td> <td class="text-center"> <span class="font-weight-bold">'+ fakes +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ trues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ semitrues +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ nodatas +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ rejects +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ comments +'</span> </td>  <td class="text-center"> <span class="font-weight-bold">'+ requests +'</span> </td> </tr>';
  })
  .catch((error) => {
    document.getElementById('leaderboard').innerHTML = '<tr><td class="text-center"> <span class="font-weight-bold">Немає даних</span> </td> </tr>';
  });
    
}

function getNewsletter() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const checkedMinNews = document.getElementById('checkedMinNews').value;
  const checkedMaxNews = document.getElementById('checkedMaxNews').value;
  const subscribed = document.getElementById('subscribed').checked;
  document.getElementById('users').innerHTML = 'Підрахунок...';

  fetch("../newsletterAPI/get?" + new URLSearchParams({
    from: from,
    to: to,
    checkedMinNews: checkedMinNews,
    checkedMaxNews: checkedMaxNews,
    subscribed: subscribed
  }))
  .then(response => response.json())
  .then(res => {
    document.getElementById('users').innerHTML = res.amount;
  })
  .catch((error) => {
    alert(error);
  });
}

function checkForm () {
  const message = document.getElementById('message').value;
  if (message == '') {
    document.getElementById('sendBtn').style.display = 'none';
  } else {
    document.getElementById('sendBtn').style.display = 'block';
  }
}

function runNewsletter() {
  const from = document.getElementById('from').value;
  const to = document.getElementById('to').value;
  const checkedMinNews = document.getElementById('checkedMinNews').value;
  const checkedMaxNews = document.getElementById('checkedMaxNews').value;
  const subscribed = document.getElementById('subscribed').checked;
  const message = document.getElementById('message').value;

  if (message == '') return alert('Повідомлення не може бути пустим');

  fetch("../newsletterAPI/send?" + new URLSearchParams({
    from: from,
    to: to,
    checkedMinNews: checkedMinNews,
    checkedMaxNews: checkedMaxNews,
    subscribed: subscribed,
    message: message
  }))
  .then(response => response.json())
  .then(res => {
    alert('Успішно запущено')
  })
  .catch((error) => {
    alert(error);
  });
}

function getSourcestats() {
  const orderBy = document.getElementById('orderBy').value;
  fetch("../sourcestatsAPI/get?" + new URLSearchParams({sort: orderBy}))
  .then(response => response.json())
  .then(res => {
    document.getElementById('sourcestats').innerHTML = '';
    for (var i in res) {
      let channelLink = '../channelrequests?channel_id='+ res[i].sourceTgId
      let tableRow =
        `<tr>
          <td class="text-center">
            <span class="font-weight-bold">
              <a href="${channelLink}">${res[i].sourceTgId}</a>
            </span>
          </td>
          <td class="text-center">
            <span class="font-weight-bold">
              <a href="${channelLink}">${res[i].sourceName}</a>
            </span>
          </td>`
      const fakeStatuses = ['false', 'true', 'manipulation', 'noproof', 'reject'];
      for (var n in fakeStatuses) {
        let cellText = '';
        let fakeStatus = fakeStatuses[n]
        let statusCount = res[i][fakeStatus + "Count"]
        if (statusCount > 0) {
          cellText = `<a href="${channelLink}&fakeStatus=${fakeStatus}">${statusCount}</a>`
        } else {
          cellText = statusCount
        }
        tableRow +=
          `<td class="text-center">
            <span class="font-weight-bold">
              ${cellText}
            </span>
          </td>`
      }
      tableRow +=
          `<td class="text-center">
            <span class="font-weight-bold">${res[i].totalRequests}</span>
          </td>
        </tr>`
      document.getElementById('sourcestats').innerHTML += tableRow;
    }
  })
  .catch((error) => {
    document.getElementById('sourcestats').innerHTML = '<tr><td class="text-center"> <span class="font-weight-bold">Немає даних</span> </td> </tr>';
  });

}

function createQuiz() {
  const name = document.getElementById('name').value;
  const description = document.getElementById('description').value;

  if (name == '' || description == '') return alert('Заповність назву та опис');
  
  fetch("../quizAPI/create", {
      method: "POST",
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({name: name, description: description})
    }).then(res => {
      return window.location.href = "../quiz";
    });
}

function updateQuiz(Qid) {
  const name = document.getElementById('name').value;
  const description = document.getElementById('description').value;
  const maxQ = document.getElementById('maxQ').value;
  const active = document.getElementById('active').checked;

  if (name == '' || description == '' || maxQ == '') return alert('Заповність назву, опис та кількість днів');
  
  fetch("../quizAPI/update", {
      method: "POST",
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({name: name, description: description, maxQuestions: maxQ, active: active, Qid: Qid})
    }).then(res => {
      return window.location.href = "../quiz";
    });
}

var editingQ = null;
function addQuestion() {
  var element = document.getElementById("questionP");
  element.classList.add("show");
  editingQ = null;
  fillInData({
    name: '',
    correct: '',
    incorrect1: '',
    explain: '',
    correctExplain: '',
    video: ''
  });
}

function updateQuestion(id) {
  var element = document.getElementById("questionP");
  element.classList.add("show");
  editingQ = id;

  fetch('../quizAPI/question?' + editingQ)
  .then(response => response.json())
  .then(data => {
    fillInData(data);
  })
  .catch(error => {
    console.error('Error fetching data:', error);
  });

}

function fillInData(data) {

  document.getElementById('q-name').value = data.name;
  document.getElementById('q-correct').value = data.correct;
  document.getElementById('q-incorrect1').value = data.incorrect1;
  if(data.incorrect2) document.getElementById('q-incorrect2').value = data.incorrect2;
  else document.getElementById('q-incorrect2').value = '';
  if(data.incorrect3) document.getElementById('q-incorrect3').value = data.incorrect3;
  else document.getElementById('q-incorrect3').value = '';
  document.getElementById('q-explain').value = data.explain;
  if(data.correctExplain) document.getElementById('q-correctExplain').value = data.correctExplain;
  else document.getElementById('q-correctExplain').value = '';

  if (data.image) {
    var dataURL = "../images/" + data.image;
    var output = document.getElementById('output');
    output.src = dataURL;
  } else {
    var output = document.getElementById('output');
    output.src = '';
  }
}

function openFile(event) {
  var input = event.target;
  
  if(input.files[0]) {
    var reader = new FileReader();
    reader.onload = function(){
      var dataURL = reader.result;
      var output = document.getElementById('output');
      output.src = dataURL;
    };
    reader.readAsDataURL(input.files[0]);
  } else {
    var output = document.getElementById('output');
    output.src = '';
  }
};

function addNewQuestion() {

  const formData = new FormData();

  const loc = window.location.href;
  const quizCode = loc.split('quiz/')[1];
  formData.append('quizCode', quizCode);

  const name = document.getElementById('q-name').value;
  if (name == '') return alert('Заповність назву питання');
  formData.append('name', name);

  const correct = document.getElementById('q-correct').value;
  if (correct == '') return alert('Заповність правильну відповідь');
  formData.append('correct', correct);
  
  const incorrect1 = document.getElementById('q-incorrect1').value;
  if (incorrect1 == '') return alert('Заповність першу неправильну відповідь');
  formData.append('incorrect1', incorrect1);

  const incorrect2 = document.getElementById('q-incorrect2').value;
  if (incorrect2 != '') formData.append('incorrect2', incorrect2);
  const incorrect3 = document.getElementById('q-incorrect3').value;
  if (incorrect3 != '') formData.append('incorrect3', incorrect3);

  const explain = document.getElementById('q-explain').value;
  if (explain == '') return alert('Заповність пояснення для неправильної відповіді');
  formData.append('explain', explain);

  const correctExplain = document.getElementById('q-correctExplain').value;
  if (correctExplain == '') return alert('Заповність пояснення для правильної відповіді');
  formData.append('correctExplain', correctExplain);

  const imageInput = document.getElementById('q-image');
  const file = imageInput.files[0];
  if (file) formData.append('image', file);
  
  document.getElementById('submQ').style.display = 'none';

  if(!editingQ) {
    fetch("../quizAPI/createQuestion", {
      method: "POST", 
      body: formData
    }).then(res => {
      location.reload();
    });
  } else {
    formData.append('Qid', editingQ);
    fetch("../quizAPI/updateQuestion", {
      method: "POST", 
      body: formData
    }).then(res => {
      location.reload();
    });
  }
}

function removeQuestion(Qid) {

  if (!confirm('Підтвердіть видалення питання?')) return

  const data = {};
  const loc = window.location.href;
  const quizCode = loc.split('quiz/')[1];
  data.question = Qid;
  data.quizCode = quizCode;

  fetch("../quizAPI/deleteQuestion", {
    method: "POST",
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify(data)
  }).then(res => {
    location.reload();
  });

}

//Black/White lists
function getSourceData(id) {
  var element = document.getElementById("sourceP");
  element.classList.add("show");
  editingQ = id;

  fetch('../blacklistAPI/source?' + editingQ)
  .then(response => response.json())
  .then(data => {
    fillInSourceData(data);
  })
  .catch(error => {
    console.error('Error fetching data:', error);
  });

}

function fillInSourceData(data) {

  document.getElementById('s-name').innerHTML = data.name;
  document.getElementById('s-active').checked = data.fake;
  document.getElementById('s-description').value = data.description;
  document.getElementById('s-update').href = 'javascript:updateSource("'+ data.id +'")';

}

function updateSource(id) {
  const fake = document.getElementById('s-active').checked;
  const description = document.getElementById('s-description').value;
  
  fetch("../blacklistAPI/update", {
      method: "POST",
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({id: id, fake: fake, description: description})
    }).then(res => {
      return window.location.href = "../blacklist";
    });
}

function removeSource(id) {

  if (!confirm('Підтвердіть видалення джерела?')) return

  fetch("../blacklistAPI/deleteSource", {
    method: "POST",
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({id: id})
  }).then(res => {
    location.reload();
  });

}

function removeMonitoring(id) {

  if (!confirm('Підтвердіть видалення джерела?')) return

  fetch("../monitoringAPI/deleteSource", {
    method: "POST",
    headers: {'Content-Type': 'application/json'}, 
    body: JSON.stringify({id: id})
  }).then(res => {
    location.reload();
  });

}

function showAddMonitoring() {
  var element = document.getElementById("monitoringP");
  element.classList.add("show");
}

function addMonitoring() {
  var username = document.getElementById('m-username').value;
  if (username.startsWith('@')) username = username.substring(1);
  const keywords = document.getElementById('m-keywords').value;

  if (username == '' || keywords == '') return alert('Заповність username та keywords');
  
  fetch("../monitoringAPI/create", {
      method: "POST",
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({username: username, keywords: keywords})
    }).then(res => {
      return window.location.href = "../monitoring";
    });
}

//AI checks
function getAIchecks(page) {

  fetch("../AIchecksAPI/get?" + new URLSearchParams({
    page: page
  }))
  .then(response => response.json())
  .then(res => {
    const pages = res.pages;
    const checks = res.checks;

    document.getElementById('ai-checks').innerHTML = '';
    for (var i in checks) {
      var fakeStatus;
      if(checks[i].fakeStatus == '1') fakeStatus = 'Правда';
      else if(checks[i].fakeStatus == '-1') fakeStatus = 'Фейк';
      else if(checks[i].fakeStatus == '-2') fakeStatus = 'Відхилено';
      else if(checks[i].fakeStatus == '-4') fakeStatus = 'Немає доказів';
      else if(checks[i].fakeStatus == '-5') fakeStatus = 'Маніпуляція';
      else fakeStatus = 'Невідомо';

      const createdAt = new Date(checks[i].createdAt).toLocaleString('uk-UA', { timeZone: 'Europe/Kiev' });

      document.getElementById('ai-checks').innerHTML += '<tr> <td class="left-pad"> <a href="/ai-checks/' + checks[i]._id + '"> <h6 class="mb-0 text-sm wrap">' + checks[i].text + '</h6></a> <p class="text-xs text-secondary mb-0">id: '+ checks[i].request?.requestId +'</p> </td> <td class="text-center"> <span class="font-weight-bold">'+ fakeStatus +'</span> </td> <td class="text-center"> <span class="font-weight-bold">'+ createdAt +'</span> </td></tr>'; 
    }

    //pagination
    var pagination = document.getElementById('pagination');
    pagination.innerHTML = '';
    if (page > 3) {
      pagination.innerHTML += '<li class="page-item"> <a class="page-link" href="javascript:void(0);" onclick="getAIchecks(1)">1</a> </li>';
      pagination.innerHTML += '<li class="page-item"> <a class="page-link" href="javascript:void(0);">...</a> </li>';
    }
    for (var i = page - 2; i <= page + 2; i++) {
      if (i > 0 && i <= pages) {
        if (i == page) {
          pagination.innerHTML += '<li class="page-item active"> <a class="page-link" href="javascript:void(0);">' + i + '</a> </li>';
        } else {
          pagination.innerHTML += '<li class="page-item"> <a class="page-link" href="javascript:void(0);" onclick="getAIchecks(' + i + ')">' + i + '</a> </li>';
        }
      }
    }
    if (page < pages - 2) {
      pagination.innerHTML += '<li class="page-item"> <a class="page-link" href="javascript:void(0);">...</a> </li>';
      pagination.innerHTML += '<li class="page-item"> <a class="page-link" href="javascript:void(0);" onclick="getAIchecks(' + pages + ')">' + pages + '</a> </li>';
    }

  })
  .catch((error) => {
    document.getElementById('ai-checks').innerHTML = '<tr><td class="text-center"> <span class="font-weight-bold">Немає даних</span> </td> </tr>';
  });
    
}

//Update AI check
function updateAICheck(id) {
  const betterComment = document.getElementById('betterComment').value;
  const betterFakeStatus = document.getElementById('betterFakeStatus').value;
  
  fetch("../AIchecksAPI/update", {
      method: "POST",
      headers: {'Content-Type': 'application/json'}, 
      body: JSON.stringify({id: id, betterComment: betterComment, betterFakeStatus: betterFakeStatus})
    }).then(res => {
      return window.location.href = "../ai-checks";
    });
}