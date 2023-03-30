import { initializeApp } from "https://www.gstatic.com/firebasejs/9.6.1/firebase-app.js";

import {
  getAuth,
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-auth.js";

import {
  getDatabase,
  ref,
  set,
  query,
  orderByChild,
  limitToLast,
  onChildAdded,
  onChildChanged,
  onChildRemoved,
  onValue,
  push,
  runTransaction,
  off,
  get,
  child,
  update,
} from "https://www.gstatic.com/firebasejs/9.6.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyBKQSNOdz83RUz9HYbVV3gjdfcvmrpmliI",
  authDomain: "replicator-37607.firebaseapp.com",
  databaseURL: "https://replicator-37607.firebaseio.com",
  projectId: "replicator-37607",
  storageBucket: "replicator-37607.appspot.com",
  messagingSenderId: "1082371143398",
  appId: "1:1082371143398:web:e3b0f970797e9303bd6d27",
  measurementId: "G-RDVGL3ZN2L",
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const database = getDatabase(app);

// Shortcuts to DOM Elements.
var messageForm = document.getElementById("message-form");
var messageInput = document.getElementById("new-post-message");
var titleInput = document.getElementById("new-post-title");
var signInButton = document.getElementById("sign-in-button");
var signOutButton = document.getElementById("sign-out-button");
var splashPage = document.getElementById("page-splash");
var addPost = document.getElementById("add-post");
var addButton = document.getElementById("add");
var recentPostsSection = document.getElementById("recent-posts-list");
var userPostsSection = document.getElementById("user-posts-list");
var topUserPostsSection = document.getElementById("top-user-posts-list");
var recentMenuButton = document.getElementById("menu-recent");
var myPostsMenuButton = document.getElementById("menu-my-posts");
var myTopPostsMenuButton = document.getElementById("menu-my-top-posts");
var listeningFirebaseRefs = [];

/**
 * Saves a new post to the Firebase DB.
 */
function writeNewPost(uid, username, picture, title, body) {
  // A post entry.
  var postData = {
    author: username,
    uid: uid,
    body: body,
    title: title,
    starCount: 0,
    authorPic: picture,
  };

  // Get a key for a new Post.
  var newPostKey = push(child(ref(database), "posts")).key;

  // Write the new post's data simultaneously in the posts list and the user's post list.
  var updates = {};
  updates["/posts/" + newPostKey] = postData;
  updates["/user-posts/" + uid + "/" + newPostKey] = postData;

  return update(ref(database), updates);
}

/**
 * Star/unstar post.
 */
function toggleStar(postRef, uid) {
  runTransaction(postRef, function (post) {
    if (post) {
      if (post.stars && post.stars[uid]) {
        post.starCount--;
        post.stars[uid] = null;
      } else {
        post.starCount++;
        if (!post.stars) {
          post.stars = {};
        }
        post.stars[uid] = true;
      }
    }
    return post;
  });
}

/**
 * Creates a post element.
 */
function createPostElement(
  postId,
  title,
  text,
  author,
  authorId,
  authorPic
) {
  var uid = auth.currentUser.uid;

  var html =
    '<div class="post post-' +
    postId +
    " mdl-cell mdl-cell--12-col " +
    'mdl-cell--6-col-tablet mdl-cell--4-col-desktop mdl-grid mdl-grid--no-spacing">' +
    '<div class="mdl-card mdl-shadow--2dp">' +
    '<div class="mdl-card__title mdl-color--light-blue-600 mdl-color-text--white">' +
    '<h4 class="mdl-card__title-text"></h4>' +
    "</div>" +
    '<div class="header">' +
    "<div>" +
    '<div class="avatar"></div>' +
    '<div class="username mdl-color-text--black"></div>' +
    "</div>" +
    "</div>" +
    '<span class="star">' +
    '<div class="not-starred material-icons">star_border</div>' +
    '<div class="starred material-icons">star</div>' +
    '<div class="star-count">0</div>' +
    "</span>" +
    '<div class="text"></div>' +
    '<div class="comments-container"></div>' +
    '<form class="add-comment" action="#">' +
    '<div class="mdl-textfield mdl-js-textfield">' +
    '<input class="mdl-textfield__input new-comment" type="text">' +
    '<label class="mdl-textfield__label">Comment...</label>' +
    "</div>" +
    "</form>" +
    "</div>" +
    "</div>";

  // Create the DOM element from the HTML.
  var div = document.createElement("div");
  div.innerHTML = html;
  var postElement = div.firstChild;
  if (componentHandler) {
    componentHandler.upgradeElements(
      postElement.getElementsByClassName("mdl-textfield")[0]
    );
  }

  var addCommentForm =
    postElement.getElementsByClassName("add-comment")[0];
  var commentInput = postElement.getElementsByClassName("new-comment")[0];
  var star = postElement.getElementsByClassName("starred")[0];
  var unStar = postElement.getElementsByClassName("not-starred")[0];

  // Set values.
  postElement.getElementsByClassName("text")[0].innerText = text;
  postElement.getElementsByClassName(
    "mdl-card__title-text"
  )[0].innerText = title;
  postElement.getElementsByClassName("username")[0].innerText =
    author || "Anonymous";
  postElement.getElementsByClassName("avatar")[0].style.backgroundImage =
    'url("' + (authorPic || "./silhouette.jpg") + '")';

  // Listen for comments.
  var commentsRef = ref(database, "post-comments/" + postId);
  onChildAdded(commentsRef, function (data) {
    addCommentElement(
      postElement,
      data.key,
      data.val().text,
      data.val().author
    );
  });

  onChildChanged(commentsRef, function (data) {
    setCommentValues(
      postElement,
      data.key,
      data.val().text,
      data.val().author
    );
  });

  onChildRemoved(commentsRef, function (data) {
    deleteComment(postElement, data.key);
  });

  // Listen for likes counts.
  var starCountRef = ref(database, "posts/" + postId + "/starCount");

  onValue(starCountRef, function (snapshot) {
    updateStarCount(postElement, snapshot.val());
  });

  // Listen for the starred status.
  var starredStatusRef = ref(
    database,
    "posts/" + postId + "/stars/" + uid
  );
  onValue(starredStatusRef, function (snapshot) {
    updateStarredByCurrentUser(postElement, snapshot.val());
  });

  // Keep track of all Firebase reference on which we are listening.
  listeningFirebaseRefs.push(commentsRef);
  listeningFirebaseRefs.push(starCountRef);
  listeningFirebaseRefs.push(starredStatusRef);

  // Create new comment.
  addCommentForm.onsubmit = function (e) {
    e.preventDefault();
    createNewComment(
      postId,
      auth.currentUser.displayName,
      uid,
      commentInput.value
    );
    commentInput.value = "";
    commentInput.parentElement.MaterialTextfield.boundUpdateClassesHandler();
  };

  // Bind starring action.
  var onStarClicked = function () {
    var globalPostRef = ref(database, "/posts/" + postId);

    var userPostRef = ref(
      database,
      "/user-posts/" + authorId + "/" + postId
    );
    toggleStar(globalPostRef, uid);
    toggleStar(userPostRef, uid);
  };
  unStar.onclick = onStarClicked;
  star.onclick = onStarClicked;

  return postElement;
}

/**
 * Writes a new comment for the given post.
 */
function createNewComment(postId, username, uid, text) {
  var commentRef = ref(database, "post-comments/" + postId);
  push(commentRef, {
    text: text,
    author: username,
    uid: uid,
  });
}

/**
 * Updates the starred status of the post.
 */
function updateStarredByCurrentUser(postElement, starred) {
  if (starred) {
    postElement.getElementsByClassName("starred")[0].style.display =
      "inline-block";
    postElement.getElementsByClassName("not-starred")[0].style.display =
      "none";
  } else {
    postElement.getElementsByClassName("starred")[0].style.display =
      "none";
    postElement.getElementsByClassName("not-starred")[0].style.display =
      "inline-block";
  }
}

/**
 * Updates the number of stars displayed for a post.
 */
function updateStarCount(postElement, nbStart) {
  postElement.getElementsByClassName("star-count")[0].innerText = nbStart;
}

/**
 * Creates a comment element and adds it to the given postElement.
 */
function addCommentElement(postElement, id, text, author) {
  var comment = document.createElement("div");
  comment.classList.add("comment-" + id);
  comment.innerHTML =
    '<span class="username"></span><span class="comment"></span>';
  comment.getElementsByClassName("comment")[0].innerText = text;
  comment.getElementsByClassName("username")[0].innerText =
    author || "Anonymous";

  var commentsContainer =
    postElement.getElementsByClassName("comments-container")[0];
  commentsContainer.appendChild(comment);
}

/**
 * Sets the comment's values in the given postElement.
 */
function setCommentValues(postElement, id, text, author) {
  var comment = postElement.getElementsByClassName("comment-" + id)[0];
  comment.getElementsByClassName("comment")[0].innerText = text;
  comment.getElementsByClassName("fp-username")[0].innerText = author;
}

/**
 * Deletes the comment of the given ID in the given postElement.
 */
function deleteComment(postElement, id) {
  var comment = postElement.getElementsByClassName("comment-" + id)[0];
  comment.parentElement.removeChild(comment);
}

/**
 * Starts listening for new posts and populates posts lists.
 */
function startDatabaseQueries() {
  var myUserId = auth.currentUser.uid;

  var topUserPostsRef = query(
    ref(database, "user-posts/" + myUserId),
    orderByChild("starCount")
  );

  var recentPostsRef = query(ref(database, "posts"), limitToLast(100));
  var userPostsRef = query(ref(database, "user-posts/" + myUserId));

  var userPostsRef = ref(database, "user-posts/" + myUserId);

  var fetchPosts = function (postsRef, sectionElement) {
    onChildAdded(postsRef, function (data) {
      var author = data.val().author || "Anonymous";

      var containerElement =
        sectionElement.getElementsByClassName("posts-container")[0];

      containerElement.insertBefore(
        createPostElement(
          data.key,
          data.val().title,
          data.val().body,
          author,
          data.val().uid,
          data.val().authorPic
        ),

        containerElement.firstChild
      );
    });

    onChildChanged(postsRef, function (data) {
      var containerElement =
        sectionElement.getElementsByClassName("posts-container")[0];

      var postElement = containerElement.getElementsByClassName(
        "post-" + data.key
      )[0];

      postElement.getElementsByClassName(
        "mdl-card__title-text"
      )[0].innerText = data.val().title;

      postElement.getElementsByClassName("username")[0].innerText =
        data.val().author;

      postElement.getElementsByClassName("text")[0].innerText =
        data.val().body;

      postElement.getElementsByClassName("star-count")[0].innerText =
        data.val().starCount;
    });

    onChildRemoved(postsRef, function (data) {
      var containerElement =
        sectionElement.getElementsByClassName("posts-container")[0];
      var post = containerElement.getElementsByClassName(
        "post-" + data.key
      )[0];
      post.parentElement.removeChild(post);
    });
  };

  // Fetching and displaying all posts of each sections.
  fetchPosts(topUserPostsRef, topUserPostsSection);
  fetchPosts(recentPostsRef, recentPostsSection);
  fetchPosts(userPostsRef, userPostsSection);

  // Keep track of all Firebase refs we are listening to.
  listeningFirebaseRefs.push(topUserPostsRef);
  listeningFirebaseRefs.push(recentPostsRef);
  listeningFirebaseRefs.push(userPostsRef);
}

/**
 * Writes the user's data to the database.
 */
function writeUserData(userId, name, email, imageUrl) {
  set(ref(database, "users/" + userId), {
    username: name,
    email: email,
    profile_picture: imageUrl,
  });
}

/**
 * Cleanups the UI and removes all Firebase listeners.
 */
function cleanupUi() {
  // Remove all previously displayed posts.
  topUserPostsSection.getElementsByClassName(
    "posts-container"
  )[0].innerHTML = "";
  recentPostsSection.getElementsByClassName(
    "posts-container"
  )[0].innerHTML = "";
  userPostsSection.getElementsByClassName(
    "posts-container"
  )[0].innerHTML = "";

  // Stop all currently listening Firebase listeners.
  listeningFirebaseRefs.forEach(function (ref) {
    off(ref);
  });
  listeningFirebaseRefs = [];
}

/**
 * The ID of the currently signed-in User. We keep track of this to detect Auth state change events that are just
 * programmatic token refresh but not a User status change.
 */
var currentUID;

/**
 * Triggers every time there is a change in the Firebase auth state (i.e. user signed-in or user signed out).
 */
function onAuthStateChanged(user) {
  // We ignore token refresh events.
  if (user && currentUID === user.uid) {
    return;
  }

  cleanupUi();
  if (user) {
    currentUID = user.uid;
    splashPage.style.display = "none";
    writeUserData(user.uid, user.displayName, user.email, user.photoURL);
    startDatabaseQueries();
  } else {
    // Set currentUID to null.
    currentUID = null;
    // Display the splash page where you can sign-in.
    splashPage.style.display = "";
  }
}

/**
 * Creates a new post for the current user.
 */

function newPostForCurrentUser(title, text) {
  var userId = auth.currentUser.uid;

  return get(ref(database, "/users/" + userId)).then(function (snapshot) {
    var username =
      (snapshot.val() && snapshot.val().username) || "Anonymous";

    return writeNewPost(
      auth.currentUser.uid,
      username,
      auth.currentUser.photoURL,
      title,
      text
    );
  });
}

/**
 * Displays the given section element and changes styling of the given button.
 */
function showSection(sectionElement, buttonElement) {
  recentPostsSection.style.display = "none";
  userPostsSection.style.display = "none";
  topUserPostsSection.style.display = "none";
  addPost.style.display = "none";
  recentMenuButton.classList.remove("is-active");
  myPostsMenuButton.classList.remove("is-active");
  myTopPostsMenuButton.classList.remove("is-active");

  if (sectionElement) {
    sectionElement.style.display = "block";
  }
  if (buttonElement) {
    buttonElement.classList.add("is-active");
  }
}

// Bindings on load.
window.addEventListener(
  "load",
  function () {
    // Bind Sign in button.
    signInButton.addEventListener("click", function () {
      var provider = new GoogleAuthProvider();
      signInWithPopup(auth, provider);
    });

    // Bind Sign out button.
    signOutButton.addEventListener("click", function () {
      signOut(auth);
    });

    // Listen for auth state changes
    auth.onAuthStateChanged(onAuthStateChanged);

    // Saves message on form submit.
    messageForm.onsubmit = function (e) {
      e.preventDefault();
      var text = messageInput.value;
      var title = titleInput.value;
      if (text && title) {
        newPostForCurrentUser(title, text).then(function () {
          myPostsMenuButton.click();
        });
        messageInput.value = "";
        titleInput.value = "";
      }
    };

    // Bind menu buttons.
    recentMenuButton.onclick = function () {
      showSection(recentPostsSection, recentMenuButton);
    };
    myPostsMenuButton.onclick = function () {
      showSection(userPostsSection, myPostsMenuButton);
    };
    myTopPostsMenuButton.onclick = function () {
      showSection(topUserPostsSection, myTopPostsMenuButton);
    };
    addButton.onclick = function () {
      showSection(addPost);
      messageInput.value = "";
      titleInput.value = "";
    };
    recentMenuButton.onclick();
  },
  false
);