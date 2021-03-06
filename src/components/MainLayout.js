import React, { PropTypes, Component } from 'react'
import {
  StyleSheet,
  Text,
  View,
  Image,
  StatusBar,
  Button,
  ScrollView,
  RefreshControl,
  Navigator,
  Platform
} from 'react-native'
import { connect } from 'react-redux'
import { Actions } from 'react-native-router-flux'

import { REHYDRATION_STATE } from '../actions/Persist'
import { FB_LOGIN_STATE } from '../actions/FBLogin'
import { CHAT_ICON_STATE } from '../actions/Chats'
import {
  REFRESH_STATE,
  startRefreshing,
  stopRefreshing,
  refreshContent,
  fetchConcertList,
  fetchChatList,
  fetchConcert,
  fetchChatMessages,
} from '../actions/Refresh'
import {
  updatingConcertList,
} from '../actions/Concerts'
import {
  setPollingTimer,
} from '../actions/Chats'

// Android offsets
androidGUIOffsetNavigation = 0

if (Platform.OS === 'android') {
  androidGUIOffsetNavigation = -2
}

class MainLayout extends Component {
  _onRefresh(store) {
    refreshContent(
      this.props.sessionToken,
      store.dispatch,
      this.props.routes.scene.sceneKey,
      this.props.routes
    )
  }

  _setChatActivityIcon(nextProps, props) {
    if (nextProps.routes.scene.sceneKey == 'chatList' ||
        nextProps.routes.scene.sceneKey == 'chatView') {
      return
    }
    if (nextProps.chatUnreadCounter > 0) {
      Actions.refresh({rightButtonImage: require('../../graphics/chatIconActivity.png')})
    } else {
      Actions.refresh({rightButtonImage: require('../../graphics/chatIcon.png')})
    }
    if (nextProps.chatIconState == CHAT_ICON_STATE.SHOWING_CHAT_ACTIVITY) {
      Actions.refresh({rightButtonImage: require('../../graphics/chatIconActivity.png')})
    } else {
      Actions.refresh({rightButtonImage: require('../../graphics/chatIcon.png')})
    }
  }

  componentWillReceiveProps(nextProps) {
    const { store } = this.context
    // Wait for the state to be fully rehydrated
    if (nextProps.rehydrationState != REHYDRATION_STATE.FINSIHED_REHYDRATING) {
      return
    }
    // Check if we are logged in, and if not redirecting the user to the login
    // screen
    if (!(nextProps.loginState == FB_LOGIN_STATE.LOGGED_IN) &&
        nextProps.routes.scene.sceneKey != 'login') {
      Actions.login()
    }
    // Check if the chat icon state has changed
    if (nextProps.routes.scene.sceneKey != this.props.routes.scene.sceneKey) {
      this._setChatActivityIcon(nextProps, this.props)
    }
    if (nextProps.chatUnreadCounter != this.props.chatUnreadCounter ||
        nextProps.chatIconState != this.props.chatIconState) {
      this._setChatActivityIcon(nextProps, this.props)
    }
    // Check if we need to load concerts
    if (nextProps.updatingConcerts == false && !nextProps.concerts.length &&
        nextProps.loginState == FB_LOGIN_STATE.LOGGED_IN) {
      fetchConcertList(nextProps.sessionToken, store.dispatch)
      store.dispatch(updatingConcertList())
    }
    if (this.props.routes.scene.sceneKey != 'chatList' && nextProps.routes.scene.sceneKey == 'chatList') {
      fetchChatList(nextProps.sessionToken, store.dispatch)
    }
    if (this.props.routes.scene.sceneKey != 'concertView' && nextProps.routes.scene.sceneKey == 'concertView') {
      const concertId = nextProps.routes.scene.concert.id
      fetchConcert(nextProps.sessionKey, store.dispatch, concertId)
    }
    if (nextProps.routes.scene.sceneKey != 'chatView') {
      if (nextProps.pollForMessagesTimer) {
        clearTimeout(nextProps.pollForMessagesTimer)
      }
    }
    if (this.props.routes.scene.sceneKey != 'chatView' && nextProps.routes.scene.sceneKey == 'chatView') {
      // Start polling for new messages: pollForMessagesTimer
      if (nextProps.pollForMessagesTimer) {
        clearTimeout(nextProps.pollForMessagesTimer)
      }
      const chatId = nextProps.routes.scene.chat.id
      fetchChatMessages(nextProps.sessionToken, store.dispatch, chatId)
      this._pollForMessages(this._pollForMessages, store.dispatch, chatId, nextProps)
    }
  }

  _pollForMessages(pollForMessages, dispatch, chatId, nextProps) {
    if (nextProps.pollForMessagesTimer) {
      clearTimeout(nextProps.pollForMessagesTimer)
    }
    const newPollForMessagesTimer = setTimeout(() => {
      fetchChatMessages(nextProps.sessionToken, dispatch, chatId)
      pollForMessages(pollForMessages, dispatch, chatId, nextProps)
    }, 5000)
    dispatch(setPollingTimer(newPollForMessagesTimer))
  }

  render() {
    const { store } = this.context
    let topMargin = Navigator.NavigationBar.Styles.General.StatusBarHeight + Navigator.NavigationBar.Styles.General.NavBarHeight + androidGUIOffsetNavigation
    if (this.props.withoutTopMargin) {
      topMargin = 0
    }
    return (
      <ScrollView ref='scrollView'
                  keyboardDismissMode='interactive'
                  style={{flex: 1, backgroundColor: 'white', marginTop: topMargin}}
                  showsVerticalScrollIndicator={false}
                  refreshControl={
                    <RefreshControl
                      refreshing={this.props.refreshBool}
                      onRefresh={this._onRefresh.bind(this, store)}
                    />
                  }>
        <StatusBar
          background color="black"
          barStyle="light-content"/>
        <View>
          {this.props.children}
        </View>
      </ScrollView>
    )
  }
}

MainLayout.contextTypes = {
  store: React.PropTypes.object.isRequired
}

MainLayout.propTypes = {
  children: React.PropTypes.element.isRequired,
  withoutTopMargin: React.PropTypes.bool,
  routes: React.PropTypes.object,
  sessionToken: React.PropTypes.string.isRequired,
  rehydrationState: React.PropTypes.string.isRequired,
  chatUnreadCounter: React.PropTypes.number.isRequired,
  chatIconState: React.PropTypes.string.isRequired,
  loginState: React.PropTypes.string.isRequired,
  refreshing: React.PropTypes.string.isRequired,
  refreshBool: React.PropTypes.bool.isRequired,
  concerts: React.PropTypes.array.isRequired,
  updatingConcerts: React.PropTypes.bool.isRequired,
  pollForMessagesTimer: React.PropTypes.number.isRequired,
}

const mapStateToProps = function(state) {
  return {
    routes: state.routes,
    sessionToken: state.login.sessionToken,
    rehydrationState: state.persist.rehydration,
    chatUnreadCounter: state.chats.totalUnreadCount,
    chatIconState: state.chats.chatIconState,
    loginState: state.login.loginState,
    refreshing: state.refresh.refreshing,
    refreshBool: state.refresh.refreshBool,
    concerts: state.concerts.concerts,
    updatingConcerts: state.concerts.updatingConcerts,
    pollForMessagesTimer: state.chats.pollForMessagesTimer,
  }
}

module.exports = connect(mapStateToProps)(MainLayout)
